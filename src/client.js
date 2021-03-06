const Login = require('./login/index.js');
const request = require("request-promise");
const WebSocket = require("ws");

class Client{
  constructor(){
    this.ws;
  }
  async login(){
    var login = new Login();
    await login.start();

    this.host = login.host;
    this.token = login.token;
    this.secret = login.secret;
    this.api_token = login.api_token;
  }
  async call(path, data){
    return new Promise((resolve, reject) => {
        var req = {
          url: "https://" + this.host + "/api/" + path,
          method: "POST",
          json: data
        }
        data.i = this.api_token;

        request(req).then(async (body) => {
            resolve(body)
        }).catch((err) => {
            reject(err);
        })
    })
  }

  connect_ws(statusLabel, timeline){
    return new Promise((resolve, reject) => {
      this._connect(statusLabel, 0, timeline);
      resolve(0);
    })
  }

  _connect(statusLabel, count, timeline){
    var url = 'wss://' + this.host + '/streaming?i=' + this.api_token;

    if(this.ws_connected) return;

    console.log('start connect');
    const connection = new WebSocket(url);

    connection.on('open', () => {
      console.log('connected');

      statusLabel.setText('サーバーに接続しました');

      this.ws = connection;
      this.ws_connected = true;
      this._ws_heartbeat();

      setTimeout(() => {
        this._create_channel_connect(connection, "notification", "main");
        this._create_channel_connect(connection, "home", "homeTimeline");
        this._create_channel_connect(connection, "local", "localTimeline");
        this._create_channel_connect(connection, "social", "hybridTimeline");
        this._create_channel_connect(connection, "global", "globalTimeline");
      }, 300);
    });

    connection.on('ping', this._ws_heartbeat);
    connection.on('pong', this._ws_heartbeat);

    connection.on('error', (err) => {
      console.log('error!: ' + err);
      statusLabel.setText('WebSocketエラー');
    });

    connection.on('close', (cl) => {
        console.log('closed!', cl);
        statusLabel.setText('サーバーから切断されました。3秒後に再接続を試みます。');
        clearTimeout(this.pingTimeout)
        setTimeout(() => {
            this.ws_connected = false;
            this.ws = null;
            this._connect(statusLabel, count + 1, timeline);
        }, 3000);
    });

    connection.on('message', (data) => {
        this._ws_heartbeat();
        timeline.onMess(data);
    });
  }

  _create_channel_connect(con, id, channel){
    var data = {
      type: "connect",
      body: {
        id: id,
        channel: channel
      }
    }

    con.send(JSON.stringify(data));
  }

  _ws_heartbeat(){
    if(!this.ws_connected) return;
    if(this.pingTimeout) clearTimeout(this.pingTimeout);
    console.log('heartbeat!');
    this.pingTimeout = setTimeout(() => {
        this.ws.terminate();
    }, 30000 + 1000);
  }
}

module.exports = Client;
