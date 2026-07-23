import { getStandardCategory } from '../lib/category-mapper';

function testMapper() {
  console.log('--- 测试品类映射逻辑 ---');
  const testCases = [
    { input: '冰箱', expected: '家用电器' },
    { input: 'LED灯泡', expected: '照明产品' },
    { input: '未知超纲品类', expected: null },
    { input: '  刹车片 ', expected: '汽车配件' }
  ];

  for (const tc of testCases) {
    const output = getStandardCategory(tc.input);
    console.log(`输入: "${tc.input}" -> 映射输出: "${output}" (期望: "${tc.expected}")`);
    if (output !== tc.expected) {
      console.error(`❌ 测试失败: "${tc.input}" 映射结果不匹配!`);
      process.exit(1);
    }
  }
  console.log('✅ 品类映射基础测试通过！\n');
}

function testUploadFilteringMock() {
  console.log('--- 模拟 upload.ts 过滤逻辑 ---');
  const mockProducts = ['冰箱', '未知超纲品类', 'LED灯泡', '另一个超纲产品'];
  
  const ignoredCategories: string[] = [];
  const validCategories: string[] = [];

  for (const indName of mockProducts) {
    const mappedCategory = getStandardCategory(indName);
    if (!mappedCategory) {
      ignoredCategories.push(indName);
      continue;
    }
    validCategories.push(mappedCategory);
  }

  console.log('输入产品列表:', mockProducts);
  console.log('被忽略的非标准品类 (ignoredCategories):', ignoredCategories);
  console.log('保留的有效标准大类 (validCategories):', validCategories);

  if (JSON.stringify(ignoredCategories) !== JSON.stringify(['未知超纲品类', '另一个超纲产品'])) {
    console.error('❌ 测试失败: ignoredCategories 不符合预期！');
    process.exit(1);
  }
  if (JSON.stringify(validCategories) !== JSON.stringify(['家用电器', '照明产品'])) {
    console.error('❌ 测试失败: validCategories 不符合预期！');
    process.exit(1);
  }
  console.log('✅ upload.ts 过滤逻辑测试通过！\n');
}

function testPublishFilteringMock() {
  console.log('--- 模拟 publish.ts 过滤逻辑 ---');
  const mockProducts = ['纯电动汽车', '奥特曼毛绒玩具', '吸尘器'];
  
  const ignoredCategories: string[] = [];
  const mappedNames: string[] = [];

  for (const indName of mockProducts) {
    const mapped = getStandardCategory(indName);
    if (mapped) {
      mappedNames.push(mapped);
    } else {
      ignoredCategories.push(indName);
    }
  }

  console.log('输入产品列表:', mockProducts);
  console.log('被忽略的非标准品类 (ignoredCategories):', ignoredCategories);
  console.log('保留的有效标准大类 (mappedNames):', mappedNames);

  if (JSON.stringify(ignoredCategories) !== JSON.stringify(['奥特曼毛绒玩具'])) {
    console.error('❌ 测试失败: publish.ts ignoredCategories 不符合预期！');
    process.exit(1);
  }
  if (JSON.stringify(mappedNames) !== JSON.stringify(['新能源汽车及智慧出行', '家用电器'])) {
    console.error('❌ 测试失败: publish.ts mappedNames 不符合预期！');
    process.exit(1);
  }
  console.log('✅ publish.ts 过滤逻辑测试通过！\n');
}

testMapper();
testUploadFilteringMock();
testPublishFilteringMock();
console.log('🎉 所有逻辑 Mock 测试全部顺利通过！');
