#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GlobalTradeBuddy 报告查重与实体消歧单元测试
覆盖验收标准 1 (Bekaert 同源分支命中) 与 验收标准 2 (Beka 根域名消歧放行)
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "bin"))
from check_report import extract_apex_domain, disambiguate, clean_company_name, get_continents

class TestEntityDisambiguation(unittest.TestCase):

    def test_apex_domain_extraction(self):
        """测试根域名指纹提取 (含子域名、复合顶级域名等)"""
        self.assertEqual(extract_apex_domain("https://fencing.bekaert.com"), "bekaert.com")
        self.assertEqual(extract_apex_domain("https://www.beka-cookware.com"), "beka-cookware.com")
        self.assertEqual(extract_apex_domain("http://beka.cl/"), "beka.cl")
        self.assertEqual(extract_apex_domain("https://whsmithplc.co.uk"), "whsmithplc.co.uk")
        self.assertEqual(extract_apex_domain("https://store.action.com.au"), "action.com.au")
        self.assertEqual(extract_apex_domain("https://sub.domain.com.cn/path?a=1"), "domain.com.cn")
        self.assertEqual(extract_apex_domain("https://www.aldi.de"), "aldi.de")

    def test_acceptance_criteria_1_bekaert(self):
        """验收标准 1: Bekaert 命中同源分支 (根域名一致或互为子域名)"""
        cand_bekaert = {
            'id': '907a1217-e00d-47db-b301-e8707fb0664d',
            'title': 'Bekaert - 360° 企业战略情报报告',
            'primary_company': 'Bekaert',
            'market_region': '比利时, 西欧',
            'website': 'https://www.bekaert.com',
            'products': '工业制造, 五金建材'
        }
        res = disambiguate(
            target_company="Bekaert",
            target_country="United Kingdom",
            target_website="https://fencing.bekaert.com",
            candidate=cand_bekaert
        )
        self.assertEqual(res['status'], 'DUPLICATE_BRANCH')
        self.assertIn("根域名指纹同源一致", res['reason'])

    def test_acceptance_criteria_2_beka_different_domain(self):
        """验收标准 2: Beka International 识破智利 Beka 差异 (两者均提供域名且根域名不同)"""
        cand_beka_chile = {
            'id': 'b156139e-df40-4e69-8699-4bc73cce584f',
            'title': 'Beka - 360° 企业战略情报报告',
            'primary_company': 'Beka',
            'market_region': '智利',
            'website': 'http://www.beka.cl',
            'products': '建材五金'
        }
        res = disambiguate(
            target_company="Beka International",
            target_country="France",
            target_website="https://www.beka-cookware.com",
            candidate=cand_beka_chile
        )
        self.assertEqual(res['status'], 'DIFFERENT_DOMAIN')
        self.assertIn("根域名完全不同", res['reason'])

    def test_cross_border_guard_without_domain(self):
        """国别异地防护机制: 无官网域名且短名少于6字符，跨大洲降级放行"""
        cand_chile_no_domain = {
            'id': 'b156139e-df40-4e69-8699-4bc73cce584f',
            'title': 'Beka - 360° 企业战略情报报告',
            'primary_company': 'Beka',
            'market_region': '智利',
            'website': None,
            'products': '建材五金'
        }
        res = disambiguate(
            target_company="Beka",
            target_country="France",
            target_website=None,
            candidate=cand_chile_no_domain
        )
        self.assertEqual(res['status'], 'WARNING_CROSS_BORDER')
        self.assertIn("启动异地防护降级放行", res['reason'])

    def test_same_continent_without_domain_duplicate(self):
        """同一大洲无域名消歧，短名仍应防撞阻断"""
        cand_germany = {
            'id': '1111',
            'title': 'Apex - 360° 企业战略情报报告',
            'primary_company': 'Apex',
            'market_region': '德国',
            'website': None,
            'products': '五金'
        }
        res = disambiguate(
            target_company="Apex",
            target_country="France",
            target_website=None,
            candidate=cand_germany
        )
        self.assertEqual(res['status'], 'DUPLICATE')

if __name__ == '__main__':
    unittest.main()
