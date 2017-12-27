var https = require('https');
var http = require('http');
var fs = require('fs');
var url = require('url');

var app_id = "", app_secret="", server_port="", server_token="", expires_in=7200, has_error=false, timer_get='';

//读取配置文件
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

			if(Array.isArray(callback)){
				callback.forEach(function(val){
					val();
				})
			}else{
				callback();
			}
		}
	})
}
//用https请求微信服务器
function requestAccessToken(){
	var get_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="+app_id+"&secret="+app_secret;
	
	https.get(get_url, (res) => {
		res.on('data', (chunk) => {
			var remote_expires_in = 0;
			var get_data = JSON.parse(chunk);
			try{
				var remote_expires_in = get_data.expires_in;
			}catch(e){
				has_error = true;
				return;
			}
			if(expires_in < remote_expires_in-5 || expires_in > remote_expires_in+5){
				expires_in = remote_expires_in;
				updateFile('./wex_official_config.json', {expires_in: remote_expires_in}, function(err){
					if(err){
						console.log("写入配置文件失败！");
						console.error(err);
						has_error = true;
					}else{
						// console.log('写入配置文件成功！');
					}
				})
			}
			updateFile('./wex_auth_data.json', get_data, function(err){
				if(err) {
			   		console.log('写入access_token失败！');
			    	console.error(err);
			    	has_error = true;
			    } else {
			    	// console.log('写入access_token成功！');
			    }
			})
		})
	});
}

//设置定时器
function timeGetAccessToken(){
	if(timer_get){
		clearInterval(timer_get);
	}else{
		requestAccessToken();
	}
	timer_get = setInterval(function(){
		requestAccessToken();
	}, (expires_in - 8) * 1000);
}

//创建node服务用于强制刷新token
function createServer(){
	var run_port = process.env.WEX_DATA_PORTf || server_port;	//用于运行时设置端口号
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
	}).listen(run_port, function(){
		console.log("wex_back_task server runing port "+run_port+"！");
	});
}

function updateFile(file_path, data, callback){
	fs.readFile(file_path, function(err, buffer){
		if(err){
			console.log("读取文件"+file_path+"失败！");
			callback(err);
		}else{
			// console.log("读取配置成功！");
			if(buffer.length){
				var file_data = JSON.parse(buffer);
				Object.assign(file_data, data);
			}else{
				file_data = data;
			}

			fs.writeFile(file_path, new Buffer(JSON.stringify(file_data)), {flag: 'w'}, function (err) {
			   callback(err)
			});
		}
	})
}

getConfig([timeGetAccessToken, createServer]);
