# Surge / Mihomo Rules

托管 Surge 与 Mihomo(Clash Meta) 的 `.sgmodule` 模块和 `ruleset` 规则集。

## 目录结构

- `sgmodule/` – Surge 模块
- `ruleset/` – Surge / Mihomo 规则集

## 使用方式

### Surge 模块

在 Surge 的「模块」页添加远程模块链接即可:

| 模块 | 用途 |
| --- | --- |
| [Giffgaff UK VoWiFi](sgmodule/simhub-vowifi-giffgaff-uk-surge.sgmodule) | Wi-Fi Calling / ePDG, PLMN 23410 (Giffgaff) |
| [EE UK VoWiFi](sgmodule/simhub-vowifi-ee-uk-surge.sgmodule) | Wi-Fi Calling / ePDG, PLMN 23430 (EE) |

```
https://raw.githubusercontent.com/CodeDuckky/surge-mihomo-rules/main/sgmodule/simhub-vowifi-giffgaff-uk-surge.sgmodule
https://raw.githubusercontent.com/CodeDuckky/surge-mihomo-rules/main/sgmodule/simhub-vowifi-ee-uk-surge.sgmodule
```

## 规则集

规则集文件可直接用于 Surge `RULE-SET` 或 Mihomo `rule-providers`。

| 规则集 | 用途 | 建议策略 |
| --- | --- | --- |
| [AppleIntelligence.list](ruleset/AppleIntelligence.list) | Apple Intelligence / Siri / iCloud Private Relay | 美区等支持地区的代理节点 |

**Surge:**

```
RULE-SET,https://raw.githubusercontent.com/CodeDuckky/surge-mihomo-rules/main/ruleset/AppleIntelligence.list,🇺🇸 US Proxy
```

**Mihomo (Clash Meta):**

```yaml
rule-providers:
  apple-intelligence:
    type: http
    behavior: classical
    url: "https://raw.githubusercontent.com/CodeDuckky/surge-mihomo-rules/main/ruleset/AppleIntelligence.list"
    path: ./ruleset/AppleIntelligence.list
    interval: 86400

rules:
  - RULE-SET,apple-intelligence,🇺🇸 US Proxy
```

## 贡献

欢迎通过 Pull Request 提交新的 sgmodule 或 ruleset。
