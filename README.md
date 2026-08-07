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

## 贡献

欢迎通过 Pull Request 提交新的 sgmodule 或 ruleset。
