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


const AWS = require('aws-sdk');
AWS.config.update({accessKeyId: config.AwsKeyId, secretAccessKey: config.SecretKey});
s3 = new AWS.S3({params: {Bucket:config.BucketName} });

var credentials = {
  key: fs.readFileSync('./cert/mixidea.key'),
  cert: fs.readFileSync('./cert/mixidea.cert')
};


let test_fille_name = "";
const test_fille_local_path = "./public/audio/";

const serverPort = 3000;
//const serverPort = 80;
/*const serverHost = "127.0.0.1";*/

const app = express();
//const httpServer = http.createServer(app);
const httpServer = https.createServer(credentials, app);
const server = httpServer.listen(serverPort, /* serverHost,*/ ()=> {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});

test = 0;
test_socket_count = 0;


app.get('/', (req, res)=> {
  test++;
  console.log(test);
  res.send('Hello World!');
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

io.on('connection', (socket)=> {
  console.log("user connected", socket.id);
  test_socket_count++;
  console.log(test_socket_count);

  socket.on('chat_message', function (data) {
    console.log(data);
  });

	ss(socket).on('audio_record_start', (stream, data)=>{
    console.log("audio record start socket id=" + socket.id);
    console.log(data);
    const cache_buster = new Date();
    test_fille_name = "test_"+ cache_buster.getTime() + ".wav";
    const file_writer = new wav.FileWriter(
      test_fille_local_path + test_fille_name,
      {channels:1,
      sampleRate:44100,
      bitDepth:16}
    );
    stream.pipe(file_writer);
	});

	socket.on('audio_record_end', (data)=>{
    console.log(data);
    setTimeout(()=>{
      upload_file();
    },5000)
    
  })

});



const convert_sample_rate = ()=>{

}


const upload_file = ()=>{

		fs.readFile(test_fille_local_path + test_fille_name, function (err, data) {
			s3.putObject(
				{Key:  test_fille_name, ContentType: "audio/wav", Body: data, ACL: "public-read"},
		    (error, data)=>{
					if(data !==null){
						console.log("succeed to save data on S3");
						save_AudioInfo_onFirebase( test_fille_name);

					}else{
						console.log("fai to save data on S3" + error + data);
					}
				}
			);
		});
}


const save_AudioInfo_onFirebase = (filename)=>{

  const file_path = config.S3_audio_url + "/" + config.BucketName + "/" + filename;
  const database = firebase_admin.database();
  database.ref("hackerthon-ipt/record/audio").set(file_path);

}


