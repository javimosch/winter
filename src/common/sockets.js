const shortid = require('shortid');
const errToJSON = require('error-to-json');
const ElapsedTime = require('elapsed-time')

module.exports = {
	socketPromise,
	socketPromisedHandler
};

function socketPromise(socket, data) {
	return new Promise((resolve, reject) => {
		const {
			name,
			params
		} = data;
		params.projectId = process.env.PROJECT_ID||'test';
		params.__id = shortid.generate();
		var timeout = setTimeout(() => {
			reject(new Error('TIMEOUT'))
		}, 10 * 1000);
		var elapsed = ElapsedTime.new().start()
		socket.once(params.__id, response => {
			if (response.err) {
				console.error('socket',name,'errored',elapsed.getValue(),params,response.err)
				reject(response.err);
			} else {
				console.log('socket',name,'resolved',elapsed.getValue(),params)
				resolve(response.result)
			}
		});
		socket.once(params.__id + '_working', response => {
			clearTimeout(timeout);
		});
		socket.emit(name, params);
	});
}
function socketPromisedHandler(name, socket, promisedHandler){
	socket.on(name, handler);
	async function handler(socketData){
		try{
			if(!socketData.__id){
				console.error('The socket client should set __id');
				throw new Error('SOCKET_BAD_REQUEST');
			}else{
				socket.emit(socketData.__id+'_working',{});
			}
			var elapsed = ElapsedTime.new().start()
			let result = await promisedHandler(socketData);
			console.log('socket',name,'resolved',elapsed.getValue(),socketData)
			socket.emit(socketData.__id,{
				err:null,
				result
			});
		}catch(err){
			if(err.message==='SOCKET_BAD_REQUEST'){
				throw err;
			}else{
				
				//log error 
				//console.error(err);

				console.error('socket',name,'errored',elapsed.getValue(),errToJSON(err))
				socket.emit(socketData.__id,{
					err: errToJSON(err),
					result:null
				});
			}
		}
	}
}