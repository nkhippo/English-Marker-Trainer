# User Prompt Sample

## User

```
10問の Set を生成してください（1回の出力で全検証規則を満たすこと。再生成はありません）。

preset: ミックス診断
selectedTags: ["N-NP","N-UNC","N-QNT","V-TA","V-VOICE","V-MOD-DYN","V-MOD-DEO","M-AGR","M-PRON-NUM","M-PRON-CASE","M-SEQ"]

## 事前抽選 tagAllocation / scene / pool / grid
[
  {
    "id": 1,
    "tag": "N-NP",
    "sceneTag": "買い物",
    "functionTag": "情報を得る",
    "gridVariant": "article-singular",
    "gridPatterns": [
      "a {n}",
      "the {n}",
      "{n}",
      "{n}s"
    ],
    "countability": "countable"
  },
  {
    "id": 2,
    "tag": "N-UNC",
    "sceneTag": "空港",
    "functionTag": "情報を得る",
    "gridVariant": "some-any",
    "gridPatterns": [
      "{n}",
      "some {n}",
      "any {n}",
      "the {n}"
    ],
    "countability": "uncountable"
  },
  {
    "id": 3,
    "tag": "N-QNT",
    "sceneTag": "教室",
    "functionTag": "情報を得る"
  },
  {
    "id": 4,
    "tag": "V-TA",
    "sceneTag": "職場",
    "functionTag": "情報を得る"
  },
  {
    "id": 5,
    "tag": "V-VOICE",
    "sceneTag": "語学学校",
    "functionTag": "情報を得る"
  },
  {
    "id": 6,
    "tag": "V-MOD-DYN",
    "sceneTag": "寮生活",
    "functionTag": "情報を得る",
    "poolUsed": [
      "(bare)",
      "can",
      "would",
      "may"
    ]
  },
  {
    "id": 7,
    "tag": "V-MOD-DEO",
    "sceneTag": "家庭",
    "functionTag": "情報を得る",
    "poolUsed": [
      "have to",
      "must",
      "should",
      "may"
    ]
  },
  {
    "id": 8,
    "tag": "M-AGR",
    "sceneTag": "レストラン",
    "functionTag": "情報を得る"
  },
  {
    "id": 9,
    "tag": "M-PRON-NUM",
    "sceneTag": "キャリア",
    "functionTag": "情報を得る"
  },
  {
    "id": 10,
    "tag": "M-PRON-CASE",
    "sceneTag": "旅行",
    "functionTag": "情報を得る"
  }
]

## プール問の指示
問6 (V-MOD-DYN): poolUsed=["(bare)","can","would","may"]. baseVerb は場面から選び、動詞句全体として4択を構成。options の lemma は poolUsed と完全一致（順不同）。プール外禁止。
問7 (V-MOD-DEO): poolUsed=["have to","must","should","may"]. この4つの中から正解を1つ選び、残り3つを誤答として配置。options の lemma は poolUsed と完全一致（順不同）。プール外禁止。

## 名詞グリッド問の指示
問1 (N-NP): gridVariant=article-singular, gridPatterns=["a {n}","the {n}","{n}","{n}s"], countability=countable
問2 (N-UNC): gridVariant=some-any, gridPatterns=["{n}","some {n}","any {n}","the {n}"], countability=uncountable

tagAllocation のタグ・scene・poolUsed・gridPatterns を厳守すること。
N-NP / N-UNC / N-QNT では headNoun・headNounJa・countability を必ず出力すること（欠けると検証失敗）。
headNounJa は headNoun の日本語訳（例: water→水, homework→宿題）。省略禁止。
CEFR A1〜B1 語彙制約を再掲: 易しい語彙のみ。文長は template≤12語、contextEn≤10語。
```
