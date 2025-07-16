module.exports = {
  apps: [{
    name: 'admin-backoffice',
    script: 'build/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: '0.0.0.0'
    }
  }]
};
