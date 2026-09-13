// next.config.js
module.exports = {
  output: 'standalone',
  // node-sdk 是 CJS 且带动态 require，交给 Node 运行时加载，避免被 Turbopack 打包
  serverExternalPackages: ['@cloudbase/node-sdk'],
  allowedDevOrigins: ['192.168.0.95'],
}
