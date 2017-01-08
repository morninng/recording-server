var express = require('express');
const fs = require('fs');
const readline = require('readline');
const querystring =  require('querystring')
const csvWriter = require('csv-write-stream')
const useragent = require('useragent');
var router = express.Router();

/* GET users listing. */

const header_format =  {headers:["timestamp","event_id","user_id","user_name","level","file_name","tech",'module','type','element','message','browser','useragent']}
let global_logger = null;

router.get('/log_test', function (req, res) {
    res.send('log server confirmation');
})


router.get('/', function(req, res, next) {
    console.log("log is called");
    const query_obj = req.query;
    if(!global_logger){
        global_logger = csvWriter(header_format);
        global_logger.pipe(fs.createWriteStream('./public/log/client_log.txt'));
    }
    console.log(query_obj);
    if(query_obj['timestamp']){
        const timestamp = new Date(query_obj['timestamp']);
        query_obj['timestamp'] = timestamp.toISOString();
    }

    var agent = useragent.parse(req.headers['user-agent']);
    query_obj['useragent'] = req.headers['user-agent']
    query_obj['browser'] = agent.toAgent();

    global_logger.write(query_obj)
    res.header({"Access-Control-Allow-Origin":"*"})
    res.sendStatus(200);
});


module.exports = router;
