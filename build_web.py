#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_web.py - '홍동우 목사의 설교 저장소' 정적 웹 빌더 스크립트

옵시디언 볼트의 01_Raw/ 와 02_Wiki/ 디렉토리 내의 모든 마크다운 파일을 파싱하여,
정적 웹사이트(03_Web/index.html)에서 즉시 구동 가능한 data.js 번들 파일을 생성합니다.
외부 라이브러리(PyYAML 등) 없이 순수 Python 3 표준 라이브러리만으로 동작합니다.
"""

import os
import glob
import re
import json
import datetime

def parse_frontmatter(text):
    """YAML 프론트매터 파싱 (순수 파이썬 표준 라이브러리 구현)"""
    if not text.startswith('---'):
        return {}, text
    parts = text.split('---', 2)
    if len(parts) < 3:
        return {}, text
    
    fm_text = parts[1]
    body = parts[2].strip()
    meta = {}
    current_key = None
    
    for line in fm_text.splitlines():
        line = line.rstrip()
        if not line or line.startswith('#'):
            continue
        # 리스트 아이템 (- 항목)
        list_match = re.match(r'^\s*-\s+(.*)$', line)
        if list_match and current_key:
            val = list_match.group(1).strip('"\'')
            if not isinstance(meta[current_key], list):
                meta[current_key] = []
            meta[current_key].append(val)
            continue
        
        # 키-값 쌍
        key_match = re.match(r'^([a-zA-Z0-9_\-]+):\s*(.*)$', line)
        if key_match:
            k = key_match.group(1)
            v = key_match.group(2).strip()
            current_key = k
            if v == '':
                meta[k] = []
            elif v.startswith('[') and v.endswith(']'):
                items = [x.strip('"\' ') for x in v[1:-1].split(',') if x.strip()]
                meta[k] = items
            else:
                meta[k] = v.strip('"\'')
                
    return meta, body

def extract_title_and_date(path, meta, body):
    """문서의 제목과 날짜를 추출"""
    title = meta.get('subject')
    m_h1 = re.search(r'^#\s+(.+)$', body, re.MULTILINE)
    if m_h1:
        h1 = m_h1.group(1).strip()
        title = h1
    if not title:
        basename = os.path.basename(path)
        title = os.path.splitext(basename)[0]
    
    date = meta.get('created')
    if not date:
        basename = os.path.basename(path)
        m_date = re.match(r'^(\d{2})(\d{2})(\d{2})', basename)
        if m_date:
            yy, mm, dd = m_date.groups()
            year = 2000 + int(yy) if int(yy) < 70 else 1900 + int(yy)
            date = f'{year}-{mm}-{dd}'
            
    return title, str(date) if date else ''

def normalize_key(name):
    """위키링크 매칭을 위한 문자열 정규화"""
    name = os.path.splitext(os.path.basename(name))[0]
    return name.replace(' ', '_').lower()

def build_vault():
    vault_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    print(f"[BUILD_WEB] 볼트 루트: {vault_root}")
    
    raw_files = sorted(glob.glob(os.path.join(vault_root, '01_Raw/**/*.md'), recursive=True))
    wiki_files = sorted(glob.glob(os.path.join(vault_root, '02_Wiki/**/*.md'), recursive=True))
    all_files = raw_files + wiki_files
    
    docs = {}
    lookup = {}
    raw_to_wiki = {}
    wiki_to_raw = {}
    
    # 1차 패스: 모든 문서 파싱 및 기본 메타데이터 수집
    for fpath in all_files:
        rel_path = os.path.relpath(fpath, vault_root).replace('\\', '/')
        basename = os.path.splitext(os.path.basename(fpath))[0]
        
        with open(fpath, 'r', encoding='utf-8') as f:
            text = f.read()
            
        meta, body = parse_frontmatter(text)
        title, date = extract_title_and_date(rel_path, meta, body)
        
        section = 'raw' if rel_path.startswith('01_Raw/') else 'wiki'
        category = 'other'
        
        if section == 'raw':
            if 'articles/' in rel_path:
                category = 'articles'
            else:
                category = 'sermons'
        else:
            if 'synthesis/' in rel_path:
                category = 'synthesis'
            elif 'series/' in rel_path:
                category = 'series'
            elif 'theologians/' in rel_path:
                category = 'theologians'
            elif 'concepts/' in rel_path:
                category = 'concepts'
            elif 'sources/' in rel_path:
                category = 'sources'
            elif rel_path.endswith('index.md'):
                category = 'index'
            elif rel_path.endswith('log.md'):
                category = 'log'
                
        # 매핑용 키 등록
        lookup[basename] = rel_path
        lookup[normalize_key(basename)] = rel_path
        lookup[rel_path] = rel_path
        
        # sources 노트의 raw_path 매핑
        if category == 'sources' and meta.get('raw_path'):
            rp = meta.get('raw_path').replace('\\', '/')
            raw_to_wiki[rp] = rel_path
            wiki_to_raw[rel_path] = rp
            
        docs[rel_path] = {
            'id': rel_path,
            'path': rel_path,
            'basename': basename,
            'title': title,
            'date': date,
            'section': section,
            'category': category,
            'meta': meta,
            'body': body,
            'scripture': meta.get('scripture', []),
            'subject': meta.get('subject', ''),
            'period': meta.get('period', ''),
            'role': meta.get('role', ''),
            'audience': meta.get('audience', ''),
            'pastoral_context': meta.get('pastoral_context', ''),
            'tags': meta.get('tags', []),
            'theologians': meta.get('theologians', []),
            'concepts': meta.get('concepts', []),
            'series': meta.get('series', '')
        }

    # 2차 패스: 상호 크로스 링크 연결
    for rel_path, doc in docs.items():
        if doc['section'] == 'raw':
            doc['cross_link'] = raw_to_wiki.get(rel_path, '')
        elif doc['category'] == 'sources':
            doc['cross_link'] = wiki_to_raw.get(rel_path, '')
        else:
            doc['cross_link'] = ''

    # 3차 패스: 네비게이션 트리 구조 생성
    # RAW 트리 구조 생성
    raw_sermons_groups = [
        {
            'title': '1. 2016-2019 Y교회',
            'period_key': '1_Y교회',
            'path_prefix': '01_Raw/Sermons/1. 2016-2019 Y교회',
            'subfolders': [],
            'root_docs': []
        },
        {
            'title': '2. 2021-2023 C교회',
            'period_key': '2_C교회',
            'path_prefix': '01_Raw/Sermons/2. 2021-2023 C교회',
            'subfolders': [
                {'title': '갈라디아서 강해 (2021)', 'folder': '211017-211114 갈라디아서 강해', 'docs': []},
                {'title': '계시록 강해 (2021-2022)', 'folder': '211121-220102 계시록 강해', 'docs': []},
                {'title': '레위기 강해 (2022-2023)', 'folder': '221030-230108 레위기 강해', 'docs': []},
                {'title': '누가복음 강해 (2023)', 'folder': '230827-231119 누가복음 강해', 'docs': []},
                {'title': '대예배 요나서 강해 (안식월)', 'folder': '대예배', 'docs': []},
                {'title': '오후예배 설교군', 'folder': '오후예배', 'docs': []}
            ],
            'root_docs': []
        },
        {
            'title': '3. 사당역 성경공부방',
            'period_key': '3_사당역_초빙',
            'path_prefix': '01_Raw/Sermons/3. 사당역 성경공부방',
            'subfolders': [
                {'title': '대전대덕교회 청년부 수련회 (2024)', 'folder': '240216-240217 대전대덕교회 청년부 수련회', 'docs': []},
                {'title': '호원교회 청년부 수련회 (2025)', 'folder': '250214-250215 호원교회 청년부 수련회', 'docs': []},
                {'title': '산성교회 청년부 수련회 (2025)', 'folder': '250811-250812 산성교회 청년부 수련회', 'docs': []},
                {'title': '오이코스 대학교 강의 (2026)', 'folder': '260108 오이코스 대학교 강의', 'docs': []}
            ],
            'root_docs': []
        },
        {
            'title': '4. 2026 D교회',
            'period_key': '4_D교회',
            'path_prefix': '01_Raw/Sermons/4. 2026 D교회',
            'subfolders': [
                {'title': '야곱 강해 (청년부)', 'folder': '260104-260208 야곱 강해', 'docs': []},
                {'title': '욥기 강해 (청년부)', 'folder': '260222-260329 욥기 강해', 'docs': []},
                {'title': '요나서 강해 (청년부)', 'folder': '260503-260621 요나서 강해', 'docs': []},
                {'title': '다니엘서 강해 (청년부)', 'folder': '260809-261025 다니엘서 강해', 'docs': []},
                {'title': '수요예배 강해군 (중직자)', 'folder': '260617-261021 수요예배', 'docs': []},
                {'title': '청년부 진로특강', 'folder': '260705-260726 청년부 진로특강', 'docs': []}
            ],
            'root_docs': []
        }
    ]

    # RAW 파일 트리 배분
    articles_list = []
    for rel_path, doc in docs.items():
        if doc['section'] != 'raw':
            continue
        if doc['category'] == 'articles':
            articles_list.append({
                'id': doc['id'],
                'title': doc['title'],
                'date': doc['date'],
                'basename': doc['basename']
            })
            continue
            
        # 설교 파일 분류
        for group in raw_sermons_groups:
            if rel_path.startswith(group['path_prefix']):
                placed = False
                for sub in group['subfolders']:
                    sub_prefix = f"{group['path_prefix']}/{sub['folder']}/"
                    if rel_path.startswith(sub_prefix):
                        sub['docs'].append({
                            'id': doc['id'],
                            'title': doc['title'],
                            'date': doc['date'],
                            'basename': doc['basename']
                        })
                        placed = True
                        break
                if not placed:
                    group['root_docs'].append({
                        'id': doc['id'],
                        'title': doc['title'],
                        'date': doc['date'],
                        'basename': doc['basename']
                    })
                break

    # 각 그룹 내 문서 날짜순 정렬
    for group in raw_sermons_groups:
        group['root_docs'].sort(key=lambda x: x['date'] or x['basename'])
        for sub in group['subfolders']:
            sub['docs'].sort(key=lambda x: x['date'] or x['basename'])
    articles_list.sort(key=lambda x: x['date'] or x['basename'], reverse=True)

    raw_tree = {
        'sermons': raw_sermons_groups,
        'articles': articles_list,
        'total_sermons': sum(len(g['root_docs']) + sum(len(s['docs']) for s in g['subfolders']) for g in raw_sermons_groups),
        'total_articles': len(articles_list)
    }

    # WIKI 트리 구성
    synthesis_list = []
    series_list = []
    theologians_list = []
    concepts_list = []
    sources_by_period = {
        '1기 Y교회 (2016~2019)': [],
        '2기 C교회 (2021~2023)': [],
        '3기 사당역 성경공부방 (2024~2026초)': [],
        '4기 D교회 (2026)': [],
        '외부 기고문 (Articles)': []
    }

    for rel_path, doc in docs.items():
        if doc['section'] != 'wiki':
            continue
        entry = {
            'id': doc['id'],
            'title': doc['title'],
            'date': doc['date'],
            'basename': doc['basename'],
            'scripture': doc['scripture'],
            'subject': doc['subject'],
            'period': doc['period']
        }
        cat = doc['category']
        if cat == 'synthesis':
            synthesis_list.append(entry)
        elif cat == 'series':
            series_list.append(entry)
        elif cat == 'theologians':
            theologians_list.append(entry)
        elif cat == 'concepts':
            concepts_list.append(entry)
        elif cat == 'sources':
            period_val = doc['period']
            if '1_Y교회' in period_val:
                sources_by_period['1기 Y교회 (2016~2019)'].append(entry)
            elif '2_C교회' in period_val:
                sources_by_period['2기 C교회 (2021~2023)'].append(entry)
            elif '3_사당역' in period_val:
                sources_by_period['3기 사당역 성경공부방 (2024~2026초)'].append(entry)
            elif '4_D교회' in period_val:
                sources_by_period['4기 D교회 (2026)'].append(entry)
            elif '외부기고' in period_val:
                sources_by_period['외부 기고문 (Articles)'].append(entry)
            else:
                sources_by_period['1기 Y교회 (2016~2019)'].append(entry)

    synthesis_list.sort(key=lambda x: x['basename'])
    series_list.sort(key=lambda x: x['basename'])
    theologians_list.sort(key=lambda x: x['basename'])
    concepts_list.sort(key=lambda x: x['basename'])
    for p_key in sources_by_period:
        sources_by_period[p_key].sort(key=lambda x: x['date'] or x['basename'])

    wiki_tree = {
        'synthesis': synthesis_list,
        'series': series_list,
        'theologians': theologians_list,
        'concepts': concepts_list,
        'sources_by_period': sources_by_period,
        'meta_docs': [
            {'id': '02_Wiki/index.md', 'title': '마스터 카탈로그 (index.md)', 'basename': 'index'},
            {'id': '02_Wiki/log.md', 'title': '아카이브 작업 로그 (log.md)', 'basename': 'log'}
        ],
        'counts': {
            'synthesis': len(synthesis_list),
            'series': len(series_list),
            'theologians': len(theologians_list),
            'concepts': len(concepts_list),
            'sources': sum(len(v) for v in sources_by_period.values()),
            'total': len([d for d in docs.values() if d['section'] == 'wiki'])
        }
    }

    # 최종 번들 데이터 생성
    vault_data = {
        'meta': {
            'title': '홍동우 목사의 설교 저장소',
            'subtitle': '신학 및 설교 아카이브 (2016–2026)',
            'generated_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'total_docs': len(docs),
            'counts': {
                'raw_sermons': raw_tree['total_sermons'],
                'raw_articles': raw_tree['total_articles'],
                'wiki_synthesis': wiki_tree['counts']['synthesis'],
                'wiki_series': wiki_tree['counts']['series'],
                'wiki_concepts': wiki_tree['counts']['concepts'],
                'wiki_theologians': wiki_tree['counts']['theologians'],
                'wiki_sources': wiki_tree['counts']['sources']
            }
        },
        'docs': docs,
        'lookup': lookup,
        'raw_tree': raw_tree,
        'wiki_tree': wiki_tree
    }

    out_path = os.path.join(vault_root, '03_Web', 'data.js')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('// 자동 생성된 설교 아카이브 데이터 번들\n')
        f.write('window.VAULT_DATA = ')
        json.dump(vault_data, f, ensure_ascii=False, indent=None)
        f.write(';\n')

    file_size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"[BUILD_WEB] 빌드 완료: {out_path} ({file_size_mb:.2f} MB)")
    print(f"  - 총 문서 수: {len(docs)}편 (RAW: {raw_tree['total_sermons'] + raw_tree['total_articles']}편, WIKI: {wiki_tree['counts']['total']}편)")
    print(f"  - 인덱스 색인 수: {len(lookup)}개")

if __name__ == '__main__':
    build_vault()
