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

firebase_admin.initializeApp({
  credential: firebase_admin.credential.cert("secret/mixidea-91a20-firebase-adminsdk.json"),
  databaseURL: "https://mixidea-91a20.firebaseio.com"
});


const AWS = require('aws-sdk');
AWS.config.update({accessKeyId: config.AwsKeyId, secretAccessKey: config.SecretKey});
s3 = new AWS.S3({params: {Bucket:config.BucketName} });


const test_fille_name = "2outfile_name_wav.wav";
const test_fille_local_path = "./public/audio/";
//const test_fille_aws_path = "event_id/role/";

const serverPort = 3000;
const serverHost = "127.0.0.1";

const app = express();
const httpServer = http.createServer(app);
const server = httpServer.listen(serverPort, serverHost, ()=> {
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
    upload_file();
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
  database.ref("test").set(filename);

}


