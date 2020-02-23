let ioSocket = io("localhost:8000");

ioSocket.on("connect", () => console.log('connectée a la socket room'));

