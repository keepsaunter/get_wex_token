var https = require('https');
var http = require('http');
var fs = require('fs');
var url = require('url');

var app_id = "", app_secret="", server_port=124, server_token="", expires_in=7200, has_error=false, timer_get='';

function getConfig(callback){
	fs.readFile('./wex_official_config.json', function(err, buffer){
		if(err){
			console.log("读取配置失败！");
			console.log(err);
			has_error = true;
			return;
		}else{
			// console.log("读取配置成功！");
			var config_data = JSON.parse(buffer)
			app_id = config_data.appId;
			app_secret = config_data.appSecret;
			expires_in = config_data.expires_in;
			server_port = config_data.server_port;
			server_token = config_data.server_token;

			callback(app_id, app_secret);
		}
	})
}
function requestAccessToken(app_id, app_secret){
	var get_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="+app_id+"&secret="+app_secret;
	
	https.get(get_url, (res) => {
		res.on('data', (chunk) => {
			var remote_expires_in = 0;
			try{
				var remote_expires_in = JSON.parse(chunk).expires_in;
			}catch(e){
				has_error = true;
				return;
			}
			if(expires_in < remote_expires_in-5 || expires_in > remote_expires_in+5){
				var temp_buffer = new Buffer(JSON.stringify({
					appId: app_id,
					appSecret: app_secret,
					expires_in: remote_expires_in,
					server_port: server_port,
					server_token: server_token
				}));
				expires_in = remote_expires_in;
				fs.writeFile('./wex_official_config.json', temp_buffer, {flag: 'w'}, function (err) {
				   if(err) {
				   		console.log('写入配置文件失败！');
				    	console.error(err);
				    	has_error = true;
				    	return;
				    } else {
				    	// console.log('写入配置文件成功！');
				    	timeGetAccessToken(remote_expires_in);
				    }
				});
			}
			fs.writeFile('./wex_auth_data.json', chunk, {flag: 'w'}, function (err) {
			   if(err) {
			   		console.log('写入access_token失败！');
			    	console.error(err);
			    	has_error = true;
			    	return;
			    } else {
			    	// console.log('写入access_token成功！');
			    }
			});
		})
	});
}
function timeGetAccessToken(time_interval){
	if(!timer_get){
		clearInterval(timer_get);
	}
	timer_get = setInterval(function(){
		getConfig(requestAccessToken);
	}, time_interval * 1000);
}
timeGetAccessToken(expires_in);
function createServer(){
	var server = http.createServer(function(req, res){
		var req_query = url.parse(req.url).query;
		if(req_query){
			var req_token = req_query.match(/token=([^&]*)/);
		}
		res.writeHead(200, {"Content-Type": "text/html;charset=utf-8"});
		if(req_token && req_token[1] === server_token){
			timeGetAccessToken(expires_in);
			res.end('<h1 style="position:absolute;color:green;text-align:center;padding-top:18%;top:0;bottom:0;left:0;right:0;">wex数据文件已更新!</h1>');
		}else{
			res.end('<h1 style="position:absolute;color:red;text-align:center;padding-top:18%;top:0;bottom:0;left:0;right:0;">非法的请求!</h1>');
		}
	}).listen(server_port, function(){
		console.log("wex_back_task server runing port "+server_port+"！");
	});
}
createServer();