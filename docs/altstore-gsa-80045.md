# AltStore / AltServer -80045 Surge 实验模块

## 当前状态：iOS TLS 阶段阻断

2026-10-14 的设备对照测试中，已完全信任 Surge CA，普通域名的本地 HTTPS mock 成功，但 `gsa.apple.com` 的相同测试被 Safari 拒绝，AltStore 也报服务器证书无效。**此模块未能解决这台 iPhone 的登录/刷新，应停用本模块及诊断模块。**

Apple 官方要求其服务关闭 HTTPS Interception；公开的 Apple 证书规则也对 `gsa.apple.com` / `gsas.apple.com` 配置 `GS` 策略，要求 Apple 根证书及专用证书标记。结合对照结果，域名级证书固定策略是当前阻断的重要证据。没有取得该 iPhone 的 trustd 日志，不能仅凭对照测试排除所有叶证书问题。

普通根 CA 完全信任不等于满足专用域名校验。TLS 未通过时，请求/响应重写脚本无法执行；`skip-server-cert-verify` 只影响 Surge 对上游的验证，不能修改 iPhone 对 Surge 证书的校验。真正的认证兼容性修补应在客户端生成请求时完成，避免依赖 GSA MITM。

参考：[Apple 企业网络要求](https://support.apple.com/en-us/101555)、[Apple GS 证书固定规则](https://github.com/apple-oss-distributions/security_certificates/blob/main/Pinning/CertificatePinning.plist)、[trustd 按域名匹配固定规则的实现](https://github.com/apple-oss-distributions/Security/blob/main/trust/trustd/SecPinningDb.m)。

以下安装及实现说明保留用于研究，不代表已验证可用。

这是供 Surge iOS / Mac 测试的实验性模块。已做离线测试和 Mac Surge 原生引擎模拟测试，尚未通过真实 Apple 账号验证，不能保证恢复 AltStore 内刷新。

## 导入

在 Surge 模块管理中添加以下远程地址并启用：

```text
https://raw.githubusercontent.com/CodeDuckky/surge-mihomo-rules/main/sgmodule/altstore-gsa-80045.sgmodule
```

模块自动下载本仓库的 [JavaScript 脚本](../scripts/altstore-gsa-fix.js)，无需手工导入 `.js`。

1. 按 Surge 的正常流程安装并信任 Surge CA，打开 MITM 和脚本功能。已有可信 CA 可继续使用。模块只为 MITM 插入 `gsa.apple.com`，不会安装 CA 或开启全局解密。
2. 启动 Surge，确认模块和脚本下载成功。首次只测试一个账号、一次 AltStore 登录或一个应用刷新，再尝试 Refresh All。二次验证输入设备实际收到的验证码。
3. 若已安装同名本地实验模块，先停用旧模块，避免多个脚本匹配相同请求。

## 模块具体处理

| 路径/情形 | 行为 |
|---|---|
| POST `/grandslam/GsService2`，客户端标识为 Mac/Android AuthKit | `X-MMe-Client-Info` 改为帖子中的 Pixel 5 / Android 11 / akd 标识；请求正文不改 |
| `/grandslam/GsService2/lookup` | 保持原请求，不进入重写脚本 |
| Anisette provisioning | 保持原请求 |
| `/auth/verify/phone/*` 短信验证 | 保持原请求和原客户端标识，不进入重写脚本 |
| SRP complete 响应为 HTTP 200、`Response.Status.ec=0`、`hsc=409`、缺少 `au`，并有 `M2`/`spd` | 插入 `au=trustedDeviceSecondaryAuth`，其他正文内容保持原样 |
| 随后的 GET `/auth/verify/trusteddevice` | 仅在匹配设备及 Anisette 身份、60 秒内、前一步确实已修补响应时，本地返回一次 HTTP 200，省略重复推送验证码 |
| `/grandslam/GsService2/validate` | 修改为 Android 客户端标识后，真实提交验证码给 Apple；不模拟验证成功 |
| 其他客户端、错误响应、已有 `au`、无法解析或无法关联的响应 | 不改响应，也不生成 mock |

二次验证状态仅保存 SHA256 摘要、操作类型与过期时间，不保存账号明文、密码、验证码、身份令牌或 Anisette 原始值。不发起额外网络请求，不改 SRP 证明、加密的 `spd`，不改 Apple 的错误码。

同时使用多个账号且共用一个 Anisette 身份时，脚本会放弃修补二次验证，避免串用待处理状态。先停止并行登录，等待三分钟再单独测试一个账号。

## 看什么日志

Surge 脚本日志中会出现固定事件名，不输出认证内容：

- `android-login-header`：登录请求头已重写。
- `patched-missing-trusted-device-auth-type`：已识别并修补缺少 `au` 的 409 响应。
- `skip-already-pushed-code-once`：已按条件省略一次重复推送。
- `android-code-validation-header`：验证码校验请求改用 Android 标识，继续交 Apple 校验。
- `request-metadata-unavailable`：请求正文无法解析/缺少关联信息，只有请求头修补能生效。
- `response-plist-pass-through`：响应不是支持的 XML plist 或结构异常，保持原样。二进制 plist 不修补。
- `parallel-accounts-pass-through-2fa`：检测到同一身份并行账号，暂不修补 2FA。
- `state-write-failed` / `script-error-pass-through`：运行异常，保留原流程。

如果仍失败，告诉我 **最后错误码和以上事件是否出现** 即可。不要发完整认证请求头、请求正文或验证码。

## 测试时的限制

- 只有经过手机 Surge 且完成 MITM 的流量能重写。先确认 Surge 请求列表中能看到 `gsa.apple.com` 的具体 HTTPS 路径；只看到 TCP/TLS 连接不能证明重写已生效。
- 模块只覆盖 `gsa.apple.com`，不覆盖 `gsd.apple.com`。保留 Mac lookup 是为了维持帖子所用的 GSA 路径。
- 若其他模块有匹配相同 URL 的 http-request/http-response 脚本，Surge 只执行第一个匹配项；测试时需避免这类冲突。
- 远程 AltServer 模式若另需 LocalDevVPN，应确认手机 Surge 启动后该模式仍能工作。若出现 VPN 互斥或连接失败，先使用 USB / 同一 Wi-Fi 的本地 AltServer 测试；该模块处理认证，不能替代设备连接通道。
- 手机模块不会处理 Mac AltServer 自己发出的认证请求。若刷新错误发生在 Mac 端，需要在那里单独应用同样的实验配置。
- MITM 会使本机 Surge 能访问认证请求及令牌。脚本不记录这些内容，但 Surge 抓包/请求详情仍可能包含敏感字段。测试结束可禁用模块；其脚本随即停止作用，保存的相关状态会在下次执行时按时间清理。

## 已完成的验证

- Node 模拟：51 项检查通过，包含端点范围、保留短信与 lookup、响应原文保留、错误响应不改、一次性/超时状态、不同身份隔离、并行账号、Cookie 多值保留及 SHA256 与标准实现一致。
- Surge Mac 配置解析：验证配置返回 `OK`。
- Surge Mac JSC 原生脚本模拟：Android 请求头、插入 `au`、条件 mock 三项通过，使用隔离的虚拟存储和虚拟身份，没有真实 Apple 登录。
- 未验证 iPhone Surge 真实请求、Apple 账号登录或真实刷新成功。

## 来源

- [AltStore #1828：故障和 AltServer 修补讨论](https://github.com/altstoreio/AltStore/issues/1828)
- [SideInstaller d9c2831：Android 标识及已推送验证码流程](https://github.com/FrizzleM/SideInstaller/commit/d9c283190f086b79863d093fabcf23275bbaa232)
- [anisette-v3-server #61](https://github.com/Dadoum/anisette-v3-server/issues/61)
- [AltSign：当前 classic 分支依赖的认证实现](https://github.com/rileytestut/AltSign/blob/0d3c1a3cac608e724ca0c8d7404253cd5fee9495/AltSign/Sources/ALTAppleAPI%2BAuthentication.swift)
- [Surge 模块说明](https://manual.nssurge.com/profile/module.html)、[脚本路径与引擎](https://manual.nssurge.com/scripting/overview.html)、[请求脚本](https://manual.nssurge.com/scripting/http-request.html)、[响应脚本](https://manual.nssurge.com/scripting/http-response.html)
