var https = require('https');
var http = require('http');
var fs = require('fs');
var url = require('url');

var wex_conf_data_file='./wex_official_config.json', wex_auth_data_file = './wex_auth_data.json', log_file='./log.txt';
var app_id = "", app_secret="", server_port="", log_file_byte="",server_token="", expires_in=7200, has_error=false, timer_get='', notify_urls=[], set_accessToken_token='';

createFile(wex_conf_data_file, '{"appId":"","appSecret":"","expires_in":0,"log_file_byte":0,"server_port":0,"server_token":"","set_accessToken_token":"","notify_urls":[]}');
createFile(wex_auth_data_file, '{}');
createFile(log_file);
getConfig([timeGetData, createServer]);

//创建文件
function createFile(file_path, init_content){
	if(!fs.existsSync(file_path)){
		fs.writeFile(file_path, init_content?init_content:'', function (err) {
			if(err){
				console.log("创建数据文件失败！");
			}
		});
	}
}

//读取配置文件
function getConfig(callback){
	fs.readFile(wex_conf_data_file, function(err, buffer){
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
			log_file_byte = config_data.log_file_byte;
			server_port = config_data.server_port;
			server_token = config_data.server_token;
			notify_urls = config_data.notify_urls;
			set_accessToken_token = config_data.set_accessToken_token;

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
function requestWex(){
	var get_access_token_url = "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid="+app_id+"&secret="+app_secret;
	var get_jsapi_ticket_url = "https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=";

	https.get(get_access_token_url, (res) => {
		res.on('data', (chunk) => {
			var get_data = JSON.parse(chunk);
			if(!get_data.errcode){
				https.get(get_jsapi_ticket_url+get_data.access_token, (res) => {
					res.on('data', (chunk) => {
						var data = JSON.parse(chunk);
						if(!data.errcode || data.errcode == 0){
							get_data.ticket = data.ticket;
							get_data.expires_in = Math.min(get_data.expires_in, data.expires_in);
							saveRecData(get_data);
						}else{
							writeLog("获取jsapi_ticket失败："+data.errmsg+"！");
							has_error = true;
						}
					})
				});
			}else{
				writeLog("获取access_token失败："+get_data.errmsg+"！");
				has_error = true;
			}
		})
	});
}

//处理接收到的数据
function saveRecData(data){
	if(data && typeof data == 'object'){
		var remote_expires_in = data.expires_in || expires_in;
		if(expires_in < remote_expires_in-5 || expires_in > remote_expires_in+5){
			expires_in = remote_expires_in;
			updateFile(wex_conf_data_file, {expires_in: remote_expires_in}, function(err){
				if(err){
					console.log("写入配置文件失败！");
					console.error(err);
					has_error = true;
				}else{
					// console.log('写入配置文件成功！');
				}
			})
		}
		updateFile(wex_auth_data_file, data, function(err){
			if(err) {
		   		console.log('写入数据文件失败！');
		    	console.error(err);
		    	has_error = true;
		    } else {
		    	// console.log('写入数据文件成功！');
		    	delete data.expires_in;
		    	notifyOther(data);
		    }
		})
	}else{
		has_error = true;
		return;
	}
}

//设置定时器
function timeGetData(){
	if(timer_get){
		clearInterval(timer_get);
	}
	requestWex();
	
	timer_get = setInterval(function(){
		requestWex();
	}, (expires_in - 8) * 1000);
}

//创建node服务用于强制刷新数据或重置配置文件
function createServer(){
	var run_port = process.env.WEX_DATA_PORTf || server_port;	//用于运行时设置端口号
	var server = http.createServer(function(req, res){
		var req_parse = url.parse(req.url);
		var req_query = req_parse.query;
		var path_name = req_parse.pathname;
		var res_type, res_data={st: 200,data:""};

		if(req_query){
			var req_token = req_query.match(/token=([^&]*)/);
			var res_type = req_query.match(/res_type=([^&]*)/);
			res_type = res_type ? res_type[1]:'';
		}
		res.writeHead(200, {"Content-Type": "text/html;charset=utf-8"});

		if(req_token && req_token[1] === server_token){
			if(path_name == "/"){
				timeGetData(expires_in);
				res_data.data = "wex数据文件已更新!";
			}else if(path_name == "/resetConf"){
				getConfig(timeGetData);
				res_data.data = "重置配置成功!";
			}else{
				res_data = {st: 404, data:"非法请求!"}
			}
		}else{
			res_data = {st: 404, data:"非法请求!"}
		}
		res.end(getResponseContent(res_data, res_type));
	}).listen(run_port, function(){
		console.log("wex_back_task server runing port "+run_port+"！");
	});
}

//设置操作结果
function getResponseContent(data, type){
	if(type=='html'){
		if(data.st == 200){
			return '<h1 style="position:absolute;color:green;text-align:center;padding-top:18%;top:0;bottom:0;left:0;right:0;">'+data.data+'</h1>';
		}else{
			return '<h1 style="position:absolute;color:red;text-align:center;padding-top:18%;top:0;bottom:0;left:0;right:0;">'+data.data+'</h1>';
		}
	}else{
		return JSON.stringify(data);
	}
}

//更新access_token时通知变化
function notifyOther(json_data){
	notify_urls.forEach((val)=>{
		try{
			var req = http.get(val+"?set_accessToken_token="+new Buffer(set_accessToken_token).toString('base64')
				+"&new_data="+new Buffer(JSON.stringify(json_data)).toString('base64'), (res)=>{
				res.setEncoding('utf-8');
				res.on("data", (chunk)=>{
					try{
						if(JSON.parse(chunk).st != 200){
							writeLog(val+"\t同步通知失败!");
						}
					}catch(e){
						writeLog(val+"\t同步通知失败!");
					}
				})
			}).on("error", function(e){
				req.destroy();
				writeLog(val+"\t同步通知失败!");
			})
		}catch(e){
			// console.log(e);
		}
	})
}

//以更新的方式写json文件
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

//写入log；大于log_file_byte字节时自动清除
function writeLog(data){
	var date_time = new Date().toLocaleString();
	fs.readFile(log_file,'utf-8', function(err, buffer){
        if(err){
        	console.log(err);
        }else{
        	if(buffer.length > log_file_byte){
        		fs.writeFile(log_file, date_time+"\t\t"+"\t日志清除!"+"\r\n\r\n", {flag: 'w'}, function (err) {
				   if(err){
				   	 	console.log(err)
				   }else{
				   		fs.writeFile(log_file, date_time+"\t\t"+data+"\r\n", {flag: 'a'}, function (err) {
						   if(err){
						   		console.log(err)
						   }
						});
				   }
				});
        	}else{
        		fs.writeFile(log_file, date_time+"\t\t"+data+"\r\n", {flag: 'a'}, function (err) {
        			if(err){
        				console.log(err)
        			}
				});
        	}
        }
	})
}