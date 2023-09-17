const { PERMISSION } = require(':config')
module.exports = (ctx, apiName, method) => {
  const [reqRoleName, token] = (ctx.header.token || '').split('||')
  const roleName = ['editor', 'admin'].includes(reqRoleName)
    ? reqRoleName
    : 'anyone'

  const apiPerm = PERMISSION[apiName]
  // console.log(
  //   ctx.header.token,
  //   'xxxx',
  //   reqRoleName,
  //   'xxx',
  //   roleName,
  //   'xxxxx',
  //   apiName,
  //   apiPerm
  // )

  if (apiPerm) {
    const apiRolePerm = apiPerm[roleName]
    if (!apiRolePerm) ctx.throw(500, '服务端接口权限配置有误')
    if (!apiRolePerm.includes(method)) {
      if (roleName === 'anyone') {
        ctx.throw(401, '请登录后操作')
      } else {
        ctx.throw(403, '您没有权限操作')
      }
    }
    // 校验 token 是否过期
    // console.log(token)
  } else {
    /*
      如权限配置内未配置的接口名称，当前放走，交由路由层面处理
      也可在此直接 返回 404
      ctx.throw(404)
    */
  }
  return roleName
}