const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const ss = require('socket.io-stream');
const wav = require('wav');
const sox = require('sox');
const SoxCommand = require('sox-audio');
const firebase_admin = require("firebase-admin");
const serviceAccount = require("./secret/mixidea-91a20-firebase-adminsdk.json");
const config = require('./config/mixidea.conf');

const api_key = config.google_translate_apikey;
const googleTranslate = require('google-translate')(api_key);

firebase_admin.initializeApp({
  credential: firebase_admin.credential.cert("secret/mixidea-91a20-firebase-adminsdk.json"),
  databaseURL: "https://mixidea-91a20.firebaseio.com"
});


var log4js = require('log4js');
log4js.configure({
    appenders: [
        {
            "type": "dateFile",
            "category": "request",
            "filename": "logs/request.log",
            "pattern": "-yyyy-MM-dd"            
        },

    ]
});
const loggerRequest = log4js.getLogger('request');

const AWS = require('aws-sdk');
AWS.config.update({accessKeyId: config.AwsKeyId, secretAccessKey: config.SecretKey});
s3 = new AWS.S3({params: {Bucket:config.BucketName} });

var credentials = {
  key: fs.readFileSync('./cert/server.key'),
  cert: fs.readFileSync('./cert/mysslserver.crt')
};

let test_fille_name = "";
const test_fille_local_path = "./public/audio/";

//const serverPort = 3000;
const serverPort = 80;
const serverHost = "127.0.0.1";

const app = express();
//const httpServer = https.createServer(credentials,app);
const httpServer = http.createServer(app);
const server = httpServer.listen(serverPort, /* serverHost,*/ ()=> {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});

test = 0;
test_socket_count = 0;
GlobalInfo = {}

app.get('/', (req, res)=> {
  test++;
  console.log(test);
  res.send('Hello World recording server!');
});

app.get('/translate', (req,res)=>{
  console.log("translation is called");
  const querystring = req.query;
  if(!querystring || !querystring.text || !querystring.target_lang){
    return;
  }
  
  console.log(querystring.text);
  googleTranslate.translate(querystring.text, querystring.target_lang, (err, translation)=>{

    console.log(translation.translatedText);
    res.header('Access-Control-Allow-Origin', '*');
    res.status(200).send(translation.translatedText);

    if(querystring.firebase_ref){
      const database = firebase_admin.database();
      database.ref(querystring.firebase_ref).set(translation.translatedText);
    }

  })

})



const io = require('socket.io').listen(server);
io.sockets.setMaxListeners(Infinity);

const test_io = io.of('/test')
const mixidea_io = io.of('/mixidea')




mixidea_io.on('connection',(socket)=>{

  console.log("user connect to mixidea io : ", socket.id);
  test_socket_count++;
  console.log(test_socket_count);

  socket.on('disconnect', function(){
    console.log("user disconnected socket id=" + socket.id);
    loggerRequest.info("user disconnected socket id=" + socket.id);
  });

	ss(socket).on('audio_record_start', (stream, data)=>{
			console.log("audio record start socket id=" + socket.id);
			loggerRequest.info("audio record start socket id=" + socket.id);
			stream.setMaxListeners(Infinity);
			const outfile_name_original  = data.filename;
			const outfile_name = outfile_name_original.replace(/-/g, "");
      const event_id = data.event_id;
			const record_start_time = Date.now();
			console.log("audio record start at " + record_start_time + " socketid:" + socket.id);
			loggerRequest.info("audio record start at " + record_start_time + " socketid:" + socket.id);

			const sample_rate = data.sample_rate || 44100;
			eval("GlobalInfo.file_writer_count_" + outfile_name + "=1");
			eval("GlobalInfo.record_start_time_" + outfile_name + "=" + record_start_time);
		//	var outfile_name_wav  = './public/audio/' + outfile_name + "_1.wav";
			const outfile_name_wav  = './public/audio/' + event_id + "/" + outfile_name + "_1.wav";
			const outputfile_dir = './public/audio/' + event_id;
			if(!fs.existsSync(outputfile_dir)){
				fs.mkdirSync(outputfile_dir);
			}
			console.log("output file name is " + outfile_name_wav);
			loggerRequest.info("output file name is " + outfile_name_wav);

			var file_writer = new wav.FileWriter(
			 outfile_name_wav,
			 {channels:1,
			  sampleRate:sample_rate,
			  bitDepth:16}
			);
			stream.pipe(file_writer);
	});

	ss(socket).on('audio_record_resume', (stream, data)=>{
			console.log("audio record resume " + socket.id);
			loggerRequest.info("audio record resume " + socket.id);

			const outfile_name_original  = data.filename;
			const outfile_name = outfile_name_original.replace(/-/g, "");
			const prev_count = eval("GlobalInfo.file_writer_count_" + outfile_name );
			if(!prev_count){
				return;
			}
			const next_count = prev_count + 1;
			console.log("resume count is " + next_count);
			loggerRequest.info("resume count is " + next_count);
			const event_id = data.event_id;
			const sample_rate = data.sample_rate || 44100;

			eval("GlobalInfo.file_writer_count_" + outfile_name + "=next_count");
			var outfile_name_wav  = './public/audio/' + event_id + "/"  +  outfile_name + "_" + String(next_count)  + ".wav";
			console.log("output file name is " + outfile_name_wav);
			loggerRequest.info("output file name is " + outfile_name_wav);

			var file_writer = new wav.FileWriter(
				 outfile_name_wav, 
				 {channels:1,
				  sampleRate:sample_rate,
				  bitDepth:16}
			);
			stream.pipe(file_writer);
	});

  socket.on('audio_record_suspend', function(data){
    console.log("audio suspend " + socket.id);
    loggerRequest.info("audio suspend " + socket.id);
  });


  socket.on('audio_record_end', function(data){
    console.log("audio record end socket id=" + socket.id);
    loggerRequest.info("audio recording end " + socket.id);
    const outfile_name_original  = data.filename;
    const deb_style  = data.deb_style;
    const outfile_name = outfile_name_original.replace(/-/g, "");
    const role_name  = data.role_name;
    const event_id = data.event_id;
    const speech_id = data.speech_id;
    console.log("file name is " + outfile_name);
    loggerRequest.info("file name is " + outfile_name);
    console.log("role name is " + role_name);
    loggerRequest.info("role name is " + role_name);

    const record_start_time = eval("GlobalInfo.record_start_time_" + outfile_name);
    const audio_record_end_time = Date.now();
    const record_duration = audio_record_end_time - record_start_time;
    const count = eval("GlobalInfo.file_writer_count_" + outfile_name );
    console.log("audio record start " + record_start_time);
    loggerRequest.info("audio record start " + record_start_time);
    console.log("audio record end " + audio_record_end_time);
    loggerRequest.info("audio record end " + audio_record_end_time);
    console.log("recording duration is " + record_duration + " msec");
    loggerRequest.info("recording duration is " + record_duration + " msec");
    console.log("file count is " + count );
    loggerRequest.info("file count is " + count );
    eval(" delete GlobalInfo.file_writer_count_" + outfile_name );
    eval(" delete GlobalInfo.record_start_time_" + outfile_name );
    setTimeout(function(){
      convert_SampleRate_transcode_upload_S3(outfile_name,deb_style, count,  role_name, event_id, speech_id);

    }, record_duration);
  });


  socket.on('chat_message', function (data) {
    console.log(data);
  });


});



// test_io.on('connection', (socket)=> {
//   console.log("user connected to test io", socket.id);
//   test_socket_count++;
//   console.log(test_socket_count);

//   socket.on('chat_message', function (data) {
//     console.log(data);
//   });
  

// 	ss(socket).on('test_audio_record_start', (stream, data)=>{
//     console.log("audio record start socket id=" + socket.id);
//     console.log(data);
//     const cache_buster = new Date();
//     test_fille_name = "test_"+ cache_buster.getTime() + ".wav";
//     const file_writer = new wav.FileWriter(
//       test_fille_local_path + test_fille_name,
//       {channels:1,
//       sampleRate:44100,
//       bitDepth:16}
//     );
//     stream.pipe(file_writer);
// 	});

// 	socket.on('test_audio_record_end', (data)=>{
//     console.log(data);
//     setTimeout(()=>{
//       upload_file();
//     },10000)
    
//   })

// });



const convert_SampleRate_transcode_upload_S3 = (outfile_name, deb_style, count, role_name , event_id, speech_id_val)=>{
	console.log("convert_SampleRate_transcode_upload_S3 start");
	loggerRequest.info("convert_SampleRate_transcode_upload_S3 start");
	var file_list_len = count;
	for(var i=0; i< file_list_len; i++){
		convert_sample_rate(event_id, outfile_name, i);
	}
	setTimeout(function(){
		transcode_file_upload_s3_command(outfile_name, deb_style, count, role_name, event_id, speech_id_val);
	}, 10000);
}

const convert_sample_rate = function(event_id, outfile_name, i){
	var existing_file_name = './public/audio/' + event_id + "/"  + outfile_name + "_"+ String(i+1) + '.wav';
	var dest_file = './public/audio/' + event_id + "/"  + outfile_name + "_"+ String(i+1) + "_convert.wav";
	console.log("convert:" + existing_file_name);
	loggerRequest.info("convert:" + existing_file_name);
	var wstream = fs.createWriteStream(dest_file);
	var command = SoxCommand().output(wstream).outputFileType('wav').outputSampleRate(44100);
	command.input(existing_file_name);
	command.on('end', function() {
		console.log("changing sample rate succeed:" + dest_file);
		loggerRequest.info("changing sample rate succeed:" + dest_file);
	});
	command.on('error', function(err, stdout, stderr) {
		console.log("changing sample rate fail" + err + ":" + outfile_name);
		loggerRequest.info("changing sample rate fail" + err + ":" + outfile_name);
	});
	command.run();
}


const transcode_file_upload_s3_command = function(file_name,deb_style, count,  role_name , event_id, speech_id_val)
{
  console.log("transcode command is called");
	loggerRequest.info("transcode command is called");
	const dest_file = './public/audio/' + event_id + "/"  + file_name + '.mp3';
	const file_name_on_s3 = file_name + '.mp3';
	const wstream = fs.createWriteStream(dest_file);
	const command = SoxCommand().output(wstream).outputFileType('mp3');

	var source_file_list = new Array();
	var file_list_len = count;
	for(var i=0; i< file_list_len; i++){
		var each_file_name = './public/audio/' + event_id + "/"  + file_name + "_"+ String(i+1) + "_convert.wav";
		console.log(each_file_name);
		loggerRequest.info(each_file_name);
		command.input(each_file_name);
	}

	command.on('progress', function(progress) {
	  console.log('Processing progress: ', progress);
		loggerRequest.info('Processing progress: ', progress);
	});
	 
	command.on('error', function(err, stdout, stderr) {
	  console.log('transcode and connecting audio failed: ' + err);
		loggerRequest.info('transcode and connecting audio failed: ' + err);
	});
	 
	command.on('end', function() {
		console.log('transcode and connecting audio succeeded!');
		loggerRequest.info('transcode and connecting audio succeeded!');
		wstream.end();
		fs.readFile(dest_file, function (err, data) {
			s3.putObject(
				{Key: file_name_on_s3, ContentType: "audio/mp3", Body: data, ACL: "public-read"},
				function(error, data){
					if(data !==null){
						console.log("succeed to save data on S3");
						loggerRequest.info("succeed to save data on S3");

						save_AudioInfo_onFirebase(file_name_on_s3, deb_style,  role_name, event_id, speech_id_val);

					}else{
						console.log("fai to save data on S3" + error + data);
						loggerRequest.info("fai to save data on S3" + error + data);
					}
				}
			);
		});

	});
	command.run();
}





const save_AudioInfo_onFirebase = (filename,deb_style, role_name, event_id, speech_id_val)=>{

  const file_path = config.S3_audio_url + "/" + config.BucketName + "/" + filename;
	console.log(file_path);
  var child_path = "event_related/audio_transcript/" +event_id +"/" + deb_style  + "/" + role_name + "/" + speech_id_val + "/audio";
	console.log(child_path);
  const database = firebase_admin.database();
  database.ref(child_path).set(file_path, (error)=>{
		if (error) {
			console.log("saving file on firabase failed" + error + "event id " + event_id);
		} else {
			console.log("saving file on firebase succeedevent id " + event_id);
		}
  });

}

// const test_upload_file = ()=>{

// 		fs.readFile(test_fille_local_path + test_fille_name, function (err, data) {
// 			s3.putObject(
// 				{Key:  test_fille_name, ContentType: "audio/wav", Body: data, ACL: "public-read"},
// 		    (error, data)=>{
// 					if(data !==null){
// 						console.log("succeed to save data on S3");
// 						save_AudioInfo_onFirebase( test_fille_name);

// 					}else{
// 						console.log("fai to save data on S3" + error + data);
// 					}
// 				}
// 			);
// 		});log4js
// }



// const test_save_AudioInfo_onFirebase = (filename)=>{

//   const file_path = config.S3_audio_url + "/" + config.BucketName + "/" + filename;
//   const database = firebase_admin.database();
//   database.ref("hackerthon-ipt/record/audio").set(file_path);

// }


