const query = require('./query')
const { succ, getJSFile } = global.tool
const beforeHandle = getJSFile('../api/restful/before')
const afterHandle = getJSFile('../api/restful/after')
/*
  RESTFul 核心处理方法，在此加载前处理、后处理，并查询数据
*/
module.exports = async (
  ctx,
  params,
  model,
  method,
  name,
  roleName,
  id,
  next
) => {
  // 如有前处理，加载前处理
  if (beforeHandle.includes(name)) {
    // handle就是name里的method方法
    const handle = require(':@/api/restful/before/' + name)[method]
    if (handle) params = await handle(params, roleName, ctx, id)
    // console.log(params)
  }
  // 进入数据库操作
  let data = await query[method](ctx, model, method, params, id)

  // console.log(data)
  // 如有后处理，对查询结果进行处理
  if (afterHandle.includes(name)) {
    const handle = require(':@/api/restful/after/' + name)[method]
    if (handle) data = await handle(data, roleName, ctx)
  }
  ctx.body = succ(data)
}
