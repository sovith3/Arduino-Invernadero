const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {cors: {
  origin: "*",credentials: false}
});

httpServer.listen(3000);

//PORT COM TEMPERATURA ARDUINO NANO
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const port = new SerialPort('COM17', { baudRate: 9600 });
const parser = port.pipe(new Readline({ delimiter: '\n' }));


//JONNY FIVE
const five = require('johnny-five'); 

//Placa Arduino UNO
var board = new five.Board({ port: "COM10" });
board.on("ready", function() {
  let regado = false;
  let regadoAut = true;
  let hidro = new five.Led(13);
  let luz = new five.Led(12);
  let tempRiego = 47;
  hidro.off();
  luz.off();

  //SOCKET COMUNICACION servidor/cliente
  io.on('connection', socket => {
    console.log("Usuario Conectado");

    //Activar/Desactivar "Riego Automatico"
    socket.on('regadoAutomatico', function(data) {
      if(data.estado === 'off'){
        regadoAut = true;
        io.sockets.emit('regado',{estado:'Riego Manual Desactivao'});
        hidro.on()
        regado = false;
      }else if(data.estado === 'on'){
        regadoAut = false; 
        hidro.off();
        io.sockets.emit('regado',{estado:'Riego Manual Activado'});
      }
   });

    //Listeners hacia el Cliente
      socket.on('hidro', function(data) {
        //REGAR 2 SEG y esta desactivado el Riego Manual
        if(data.estado === 'on' && !regadoAut){
          hidro.on();
          setTimeout(() => { hidro.off()}, 2000);
          io.sockets.emit('regado',{estado:'Se ha regado'});
        }else if(data.estado === 'on' && regadoAut){
          io.sockets.emit('regado',{estado:'!El regado manual esta desactivado'});
        }
     });
   //ENCENDER/APAGAR LUZ
   socket.on('luz', function(data) {
      if(data.estado === 'on'){
        luz.on();
      }else{
        luz.off();
      }
    });
  });

 
//PUERTO SENSOR
  port.on("open", () => {
    //LOG
    console.log('Conección establecida');
  });
  parser.on('data', data => {
    console.log(String(data))
    let th = {
      humedad: (String(data).substring(0,6)),
      temperatura: (String(data).substring(6,12)),
      humedadInt : parseInt(String(data).substring(0,2))
    }
    //Emitir al Cliente con la data de temperatura/humedad
    io.sockets.emit('data',th);
    console.log(th)

    //Riego Automatico  si esta activado. Por 2 segundos si la humedad es menor a 45% y no a sido regado en 20 min
   if(regadoAut){
      if(!regado){
        if(th.humedadInt<tempRiego){
          hidro.on();
          setTimeout(() => { hidro.off()}, 2000);
          regado = true;
          //Establecer tiempo de regado automatico (Evitar Bucle Infinito mientras no suba de golpe la humedad)
          setTimeout(() => {regado=false}, 1200000);
          //EMITIR ESTADO RIEGO NO es necesario
          //io.sockets.emit('regado',{estado:'Regado automático, Actualizacion cada 20 minutos'});
        }
      }
  }
  });
});
