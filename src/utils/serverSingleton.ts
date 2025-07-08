
// Emergency server singleton to prevent ERR_SERVER_ALREADY_LISTEN
let serverInstance = null;
let isServerStarting = false;

export function startServerSingleton(app, port = 3000) {
  return new Promise((resolve, reject) => {
    if (serverInstance) {
      console.log('🟡 Server already running, returning existing instance');
      return resolve(serverInstance);
    }
    
    if (isServerStarting) {
      console.log('🟡 Server already starting, waiting...');
      setTimeout(() => resolve(serverInstance), 1000);
      return;
    }
    
    isServerStarting = true;
    
    try {
      serverInstance = app.listen(port, () => {
        isServerStarting = false;
        console.log(`✅ Server started on port ${port}`);
        resolve(serverInstance);
      });
      
      serverInstance.on('error', (err) => {
        isServerStarting = false;
        if (err.code === 'EADDRINUSE') {
          console.log('🟡 Port in use, server may already be running');
          resolve(null);
        } else {
          reject(err);
        }
      });
      
    } catch (error) {
      isServerStarting = false;
      reject(error);
    }
  });
}

export function getServerInstance() {
  return serverInstance;
}

export function closeServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}
