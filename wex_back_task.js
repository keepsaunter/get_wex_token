var https = require('https');
var fs = require('fs');

var app_id = "", app_secret="", expires_in=7200, has_error=false, timer_get='';

function getConfig(callback){
	fs.readFile('./wx_official_config.json', function(err, buffer){
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
				}));
				fs.writeFile('./wx_official_config.json', temp_buffer, {flag: 'w'}, function (err) {
				   if(err) {
				   		console.log('写入配置文件失败！');
				    	console.error(err);
				    	has_error = true;
				    	return;
				    } else {
				    	// console.log('写入配置文件成功！');
				    	clearInterval(timer_get);
				    	timer_get = timeGetAccessToken(remote_expires_in);
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
			    	console.log('写入access_token成功！');
			    }
			});
		})
	});
}
function timeGetAccessToken(time_interval){
	timer_get = setInterval(function(){
		getConfig(requestAccessToken);
	}, time_interval * 1000);
}
timeGetAccessToken(expires_in);
