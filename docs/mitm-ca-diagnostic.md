# MITM CA 证书对照测试

当已安装并完全信任当前 Surge CA，但 Safari / AltStore 仍提示证书无效时，用此模块区分通用 TLS 证书问题与域名相关问题。这个测试不能单独证明证书固定机制是否存在。

在 Surge 中添加并启用远程模块：

```text
https://raw.githubusercontent.com/CodeDuckky/surge-mihomo-rules/main/sgmodule/mitm-ca-diagnostic.sgmodule
```

保持 Surge 的 MITM、Rewrite 开启，使用 Safari 打开：

1. <https://example.com/surge-mitm-check>
2. <https://gsa.apple.com/surge-mitm-check>

两个路径都由 Surge 的 Map Local 返回固定文本 `SURGE MITM OK`，没有脚本、凭据读取或真实认证请求。显示其他内容/404 说明 mock 未生效，不能据此判断 CA 已正确工作。遇到证书警告时不要继续访问。

| 结果 | 意义 |
|---|---|
| 两者均显示 `SURGE MITM OK` 且无证书警告 | Safari 对这两条连接都接受了当前 Surge 证书链。继续检查 AltStore 自身连接及错误 |
| 两者均提示证书无效 | 普通域名也失败，优先检查证书链、日期、域名用途扩展及 iOS 信任评估；不能直接归因于 Apple 域名限制 |
| example.com 成功，gsa.apple.com 证书失败 | 问题与域名/该域名生成的证书有关；需比较两张叶证书的 SAN、生效日期、签发者、链及错误信息，尚不能仅凭这个结果断言 pinning |
| gsa.apple.com 本地测试成功，但真实路径仍出错 | 检查两次连接的证书是否相同，以及上游连接、缓存和请求路由 |
| 任一测试显示 404 或其他内容 | 先检查 Rewrite、MITM、模块是否生效和请求是否经过 Surge |

测试结束停用此诊断模块。域名已有其他 MITM 配置时，禁用本模块不会移除那些配置。

参考：[Surge Map Local](https://manual.nssurge.com/http/map-local.html)、[MITM](https://manual.nssurge.com/http/mitm.html)、[Apple TLS 证书要求](https://support.apple.com/en-us/103769)。
