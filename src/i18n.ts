// Minimal UI translation (English source strings -> Chinese). Item names come from the dataset (names_i18n).
let lang: 'en' | 'zh' = 'en';
export const setUiLang = (l: 'en' | 'zh') => { lang = l; };

const ZH: Record<string, string> = {
  'Undo (Ctrl+Z)': '撤销 (Ctrl+Z)', 'Redo (Ctrl+Y)': '重做 (Ctrl+Y)', '↶ Undo': '↶ 撤销', '↷ Redo': '↷ 重做',
  'Import / export': '导入 / 导出', Market: '市场', Fits: '配置', Character: '角色', Profiles: '配置文件',
  Fit: '舰船装配', Graphs: '图表', 'No fit selected.': '未选择配置。', 'No data for this graph.': '此图表无数据。',
  'Target profiles (outgoing DPS, graphs)': '目标配置（输出 DPS、图表）', 'Damage patterns (incoming damage, for EHP / RAH)': '伤害类型（受到的伤害，用于 EHP / 反应式装甲）',
  Duplicate: '复制', Delete: '删除', 'Download all fits, characters and profiles as JSON': '将所有配置、角色和配置文件下载为 JSON',
  'Backup library': '备份', 'Restore… ': '恢复… ', 'Engine backend': '引擎后端', Clone: '克隆', 'Train required': '学习所需技能',
  'Import (EFT / DNA / ESI JSON)': '导入 (EFT / DNA / ESI JSON)', 'Export EFT': '导出 EFT', 'Export DNA': '导出 DNA',
  'Export ESI JSON': '导出 ESI JSON', 'Export multibuy': '导出批量购买', 'Share link': '分享链接', Close: '关闭',
  'Show info': '显示信息', 'Role bonus:': '特有加成：', 'Misc:': '其他：', 'Required skills:': '所需技能：',
  'Engine warnings': '引擎警告', Resources: '资源', Offense: '输出', Volley: '齐射', Weapons: '武器', Drones: '无人机',
  Fighters: '铁骑舰载机', Total: '合计', Defense: '防御', Capacitor: '电容', Navigation: '航行', Targeting: '锁定',
  'Remote assistance': '远程支援', Mining: '采矿', Mutaplasmid: '突变质体', Remove: '移除',
  'Implants & boosters': '植入体和增效剂', Cargo: '货柜舱', 'Projected onto this fit': '投射到此配置',
  'Project fit': '投射配置', 'Fleet boosters (command bursts)': '舰队加成（指挥脉冲）', 'Add booster': '添加加成舰',
  'Manual fleet buffs': '手动舰队增益', Environment: '环境', Fitting: '装配', Options: '选项', 'Projected / fleet / environment': '投射 / 舰队 / 环境',
  'High slots': '高槽', 'Mid slots': '中槽', 'Low slots': '低槽', Rigs: '改装件', Subsystems: '子系统', Services: '服务槽',
  'Compute a fit first.': '请先计算配置。', Problems: '问题',
  'search fits / ships…': '搜索配置 / 舰船…', 'Pick a ship in the Market tab to start a new fit.': '在市场标签中选择舰船以新建配置。',
};
export function t(s: string): string { return lang === 'zh' ? ZH[s] ?? s : s; }
