/*
  分页数据查询方法 支持各种复杂查询条件，详情见文档
*/
const { Op } = require('Sequelize')
const { models } = require(':@/model')
const { PAGE_SIZE } = require(':config')
const { isNumer } = global.tool.verify
// 从请求参数中找出非标准参数并输出为对象
const getArgs = (params) => {
  const args = {}
  for (const i in params) {
    if (!['pagesize', 'page', 'time', 'sort'].includes(i)) args[i] = params[i]
  }
  return args
}

// 非标配置项处理字典
const ArgHandle = {
  like(arg) {
    // 模糊查询
    return { [Op.like]: `%${arg}%` }
  },
  neq(arg) {
    // 不等查询
    return { [Op.ne]: arg }
  },
  gt(arg) {
    // 大于查询
    return { [Op.gt]: arg }
  },
  gteq(arg) {
    // 大于等于查询
    return { [Op.gte]: arg }
  },
  lt(arg) {
    // 小于查询
    return { [Op.lt]: arg }
  },
  lteq(arg) {
    // 小于等于查询
    return { [Op.lte]: arg }
  },
  in(arg) {
    // in 查询 （和 无 argConf 查询多条记录是一样的）
    return { [Op.in]: arg.split(',') }
  },
  nin(arg) {
    // notIn 查询
    return { [Op.notIn]: arg.split(',') }
  },
}

module.exports = async (ctx, model, method, params) => {
  console.log(model, method, params)
  const { pagesize = PAGE_SIZE, page = 0, time } = params
  model = models[model]
  const modelField = Object.keys(model.rawAttributes)
  // console.log(modelField)
  // 校验分页参数
  if (!isNumer(pagesize) || !isNumer(page)) {
    ctx.throw(412, '参数非法, pagesize 和 page 只能是数字')
  }
  // console.log(pagesize, page)

  // 构建基础 where 参数
  const condition = {
    where: {},
    offset: page * pagesize,
    limit: Number(pagesize),
    order: [['id', 'DESC']],
  }
  // console.log(condition)
  // pagesize 为 -1 时 查询全部数据
  if (pagesize === '-1') {
    delete condition.offset
    delete condition.limit
  }
  // 处理排序
  if (params.sort) {
    const sortArr = params.sort.split(',')
    const order = []
    sortArr.forEach((i) => {
      let sortField = i
      if (i.substring(0, 1) === '-') {
        sortField = i.substring(1)
        order.push([sortField, 'DESC'])
      } else {
        order.push([sortField, 'ASC'])
      }
      if (!modelField.includes(sortField)) {
        ctx.throw(412, 'sort 排序参数包含非法字段')
      }
    })
    // console.log(order)
    condition.order = order
  }
  // 处理时间参数
  if (time) {
    const timeArr = time.split('-')
    const timeArrLen = timeArr.length
    let st, et
    if (timeArrLen > 2) ctx.throw(412, 'time参数有误')
    if (timeArr.filter((i) => !isNumer(i)).length) {
      ctx.throw(412, 'time参数只接受时间戳数字')
    }
    // 如果 timeArrLen 等于 1，表示只提供了一个时间戳，那么将其解析为时间的起始时间戳，然后计算出结束时间戳。这段代码将一天的时间范围内的记录筛选出来
    // 如果 timeArrLen 等于 2，表示提供了开始和结束时间戳，直接使用这两个时间戳作为时间范围。
    if (timeArrLen === 1) {
      const t = +timeArr[0]
      st = t - (t % 86400000)
      et = st + 86400000
    } else {
      st = +timeArr[0]
      et = +timeArr[1]
    }
    condition.where.time = {
      [Op.gte]: st,
      [Op.lte]: et,
    }
  }
  // 处理非标参数
  const args = getArgs(params)
  // console.log(args)
  for (const i in args) {
    // console.log(i)
    const [fieldName, argConf, arrErr] = i.split('-')
    // console.log(fieldName, argConf, arrErr)

    if (arrErr) ctx.throw(412, i + ' 请求参数配置非法')
    if (!modelField.includes(fieldName)) {
      ctx.throw(412, '请求参数包含非法字段 ' + fieldName)
    }
    if (!argConf) {
      /*
        处理非配置查询参数
        支持 a=1 单个相等条件查询
        支持 a=1,2,3,4,5 多个相等条件查询
          会被解析为 in 查询
      */
      const argArr = (args[i] || '').split(',')
      // console.log(args)
      // console.log(argArr)
      condition.where[fieldName] =
        argArr.length === 1 ? args[i] : { [Op.in]: argArr } // 不仅而且
      // console.log(condition)
    } else {
      // 处理配置查询参数
      if (ArgHandle[argConf]) {
        const handleReq = ArgHandle[argConf](args[i])
        const condField = condition.where[fieldName]
        // console.log(condField, condition)
        /*
          查看该字段是否已有非标配置参数
            若有，则追加 and 条件
            如 a-gt=10&a-lt=1&a-neq=5 这样的多重复核查询条件的支持
      */
        condition.where[fieldName] = condField
          ? { [Op.and]: [condField, handleReq] }
          : handleReq
        // console.log(condField, condition)
      } else {
        ctx.throw(412, i + ' 请求参数配置不被支持')
      }
    }
  }
  // console.log(condition)
  // 查询从数据库查询数据
  const res = await model.findAndCountAll(condition).then((r) => {
    return {
      page,
      list: r.rows,
      count: r.count,
    }
  })
  // console.log(res)
  return res
}
