export interface PositionDetail {
  id: string
  title: string
  company: string
  companyIndustry: string
  companyStage: string
  companySize: string
  companyLogo: string
  salary: string
  location: string
  address: string
  longitude: number
  latitude: number
  education: string
  experience: string
  tags: string[]
  recruiter: {
    name: string
    role: string
    avatar: string
    activeText: string
  }
  responsibilities: string[]
  requirements: string[]
}

const companyBase = {
  company: '三生制药',
  companyIndustry: '生物医药',
  companyStage: '已上市',
  companySize: '1000-9999人',
  companyLogo: 'https://static1.3sbio.com/assets/lingcai/logo.png',
}

const recruiterBase = {
  name: '张女士',
  role: '招聘经理',
  avatar: '/static/images/default-avatar.png',
  activeText: '刚刚活跃',
}

export const positions: PositionDetail[] = [
  {
    id: 'bio-rd-senior',
    ...companyBase,
    title: '生物药研发高级研究员',
    salary: '25-40K',
    location: '上海 · 浦东新区',
    address: '上海市浦东新区张江高科技园区李冰路399号',
    longitude: 121.60032,
    latitude: 31.20191,
    education: '硕士',
    experience: '3-5年',
    tags: ['创新药', '生物药', '研发'],
    recruiter: recruiterBase,
    responsibilities: [
      '负责创新生物药早期研发项目的实验设计、执行与数据分析，推动项目按计划完成关键里程碑。',
      '建立并优化细胞培养、蛋白表达与活性评价体系，持续提升实验效率与数据质量。',
      '协同药理、工艺及临床团队完成候选分子的筛选、评估和技术资料整理。',
      '跟踪生物药研发前沿技术，结合项目需求提出可落地的技术方案与改进建议。',
      '完成研究记录、项目报告及申报支持材料，确保研发过程真实、完整、可追溯。',
    ],
    requirements: [
      '生物学、药学、生物工程等相关专业硕士及以上学历。',
      '具备3年以上生物药研发经验，熟悉蛋白表达、纯化或活性分析技术。',
      '具备良好的实验设计、问题分析、跨团队协作与英文文献阅读能力。',
    ],
  },
  {
    id: 'medical-science-liaison',
    ...companyBase,
    title: '医学联络官（MSL）',
    salary: '20-35K',
    location: '北京 · 朝阳区',
    address: '北京市朝阳区建国路88号',
    longitude: 116.4752,
    latitude: 39.9087,
    education: '本科',
    experience: '1-3年',
    tags: ['医学事务', '临床沟通'],
    recruiter: { ...recruiterBase, name: '李女士', role: '医学招聘负责人' },
    responsibilities: [
      '负责重点治疗领域专家网络建设与高质量学术沟通。',
      '传递准确、合规的产品医学信息，收集临床需求与医学洞察。',
      '支持医学教育活动、研究者发起研究及内部医学培训。',
    ],
    requirements: [
      '临床医学、药学或生命科学相关专业本科及以上学历。',
      '具备医学事务或临床相关经验，沟通表达与学习能力优秀。',
      '能够适应一定频率的区域出差。',
    ],
  },
  {
    id: 'quality-registration',
    ...companyBase,
    company: '三生国健',
    title: '质量注册专员',
    salary: '12-18K',
    location: '沈阳 · 浑南区',
    address: '沈阳市浑南区新放街1号',
    longitude: 123.4641,
    latitude: 41.6776,
    education: '本科',
    experience: '经验不限',
    tags: ['药品注册', '质量体系'],
    recruiter: { ...recruiterBase, name: '王女士', role: '质量体系招聘负责人' },
    responsibilities: ['协助完成药品注册资料整理、申报与进度跟踪。', '维护质量体系文件并参与偏差、变更及CAPA管理。', '协调研发、生产和质量团队按要求完成审评补充资料。'],
    requirements: ['药学、生物工程等相关专业本科及以上学历。', '熟悉药品注册法规或GMP质量体系者优先。', '工作细致，具备良好的文档与沟通能力。'],
  },
  {
    id: 'business-development-supervisor',
    ...companyBase,
    title: '招商主管',
    salary: '15-25K',
    location: '广州 · 天河区',
    address: '广州市天河区珠江新城华夏路16号',
    longitude: 113.3238,
    latitude: 23.1171,
    education: '大专',
    experience: '3-5年',
    tags: ['招商主管', '医药商业'],
    recruiter: { ...recruiterBase, name: '陈先生', role: '商业团队招聘负责人' },
    responsibilities: ['制定区域招商计划并推进目标客户开发。', '负责合作伙伴准入、商务谈判与全周期关系维护。', '分析区域市场与竞品信息，持续优化招商策略。'],
    requirements: ['医药、市场营销等相关专业大专及以上学历。', '具备3年以上医药招商或商业渠道经验。', '结果导向，具备商务谈判与区域管理能力。'],
  },
  {
    id: 'clinical-operations-pm',
    ...companyBase,
    company: '三生国健',
    title: '临床运营项目经理',
    salary: '28-45K',
    location: '上海 · 徐汇区',
    address: '上海市徐汇区宜山路900号',
    longitude: 121.4117,
    latitude: 31.1763,
    education: '本科',
    experience: '5-10年',
    tags: ['临床运营', '项目管理'],
    recruiter: { ...recruiterBase, name: '周女士', role: '临床招聘负责人' },
    responsibilities: ['制定临床项目运营计划、预算与风险管理策略。', '协调研究中心、CRO及内部职能团队推进项目交付。', '监督项目质量、进度和合规性并定期输出管理报告。'],
    requirements: ['医学、药学等相关专业本科及以上学历。', '5年以上临床运营经验，具备完整项目管理经验。', '熟悉GCP及临床试验相关法规。'],
  },
  {
    id: 'protein-purification-researcher',
    ...companyBase,
    title: '蛋白纯化工艺研究员',
    salary: '18-28K',
    location: '沈阳 · 铁西区',
    address: '沈阳市铁西区经济技术开发区十号路1甲3号',
    longitude: 123.2847,
    latitude: 41.7667,
    education: '硕士',
    experience: '1-3年',
    tags: ['蛋白纯化', '工艺开发'],
    recruiter: { ...recruiterBase, name: '刘先生', role: '工艺研发招聘负责人' },
    responsibilities: ['负责重组蛋白纯化工艺开发、优化与放大研究。', '完成工艺表征、数据分析及技术报告撰写。', '协同生产和质量团队推进技术转移与问题解决。'],
    requirements: ['生物工程、生物化学等相关专业硕士及以上学历。', '熟悉层析、超滤等蛋白纯化技术。', '具备良好的实验习惯和数据分析能力。'],
  },
  {
    id: 'pharma-marketing-strategy',
    ...companyBase,
    title: '医药市场策略经理',
    salary: '22-36K',
    location: '杭州 · 滨江区',
    address: '杭州市滨江区江南大道3850号',
    longitude: 120.1476,
    latitude: 30.1879,
    education: '本科',
    experience: '3-5年',
    tags: ['市场策略', '产品规划'],
    recruiter: { ...recruiterBase, name: '赵女士', role: '市场团队招聘负责人' },
    responsibilities: ['负责产品市场洞察、品牌定位与年度策略规划。', '设计并落地学术推广项目和多渠道传播方案。', '跟踪业务表现与竞争格局，输出策略优化建议。'],
    requirements: ['医学、药学或市场营销相关专业本科及以上学历。', '3年以上医药市场或产品管理经验。', '具备数据分析、策略思考和项目推动能力。'],
  },
  {
    id: 'regional-sales-manager',
    ...companyBase,
    company: '三生国健',
    title: '区域销售经理',
    salary: '20-32K',
    location: '成都 · 高新区',
    address: '成都市高新区天府大道中段1268号',
    longitude: 104.0675,
    latitude: 30.5474,
    education: '本科',
    experience: '3-5年',
    tags: ['销售管理', '生物制药'],
    recruiter: { ...recruiterBase, name: '孙先生', role: '销售团队招聘负责人' },
    responsibilities: ['制定区域销售策略并带领团队达成业务目标。', '建设重点医院与专家网络，提升产品覆盖与规范推广。', '负责团队辅导、人才发展和区域合规管理。'],
    requirements: ['医药相关专业本科及以上学历。', '具备3年以上处方药销售及团队管理经验。', '目标感强，具备业务分析与团队领导能力。'],
  },
]

export function getPositionById(id?: string) {
  return positions.find(position => position.id === id)
}
