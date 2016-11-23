const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
//const ss = require('socket.io-stream');


const serverPort = 3000;
const serverHost = "127.0.0.1";

var app = express();
var httpServer = http.createServer(app);
const server = httpServer.listen(serverPort, serverHost, ()=> {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});


app.get('/', (req, res)=> {
  res.send('Hello World!');
});


var io = require('socket.io').listen(server);
io.sockets.setMaxListeners(Infinity);

io.on('connection', function (socket) {
  console.log("user connected");
  socket.on('chat_message', function (data) {
    console.log(data);
  });
});





