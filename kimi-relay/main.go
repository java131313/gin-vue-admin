package main

// Kimi 中继 —— IP 跳板，解决「Cloudflare Workers 出口 IP 段被 Kimi WAF 拦截」
//
// 背景：CF Workers 直调 api.kimi.com 返回 403（CF 拦截页，IP 信誉层封禁，
// 补请求头无效）；本机/云服务器 IP 正常。本服务跑在 Sealos（北京，有公网），
// 链路：Workers → 本中继 → api.kimi.com。
//
// 安全设计：
//   - 不持有任何密钥：Authorization 头原样透传，鉴权由 Kimi 完成，key 不落地
//   - 路径前缀隐蔽（RELAY_PREFIX）：不知道前缀的请求一律 404，防陌生人把
//     中继当开放代理（有前缀也不知能干嘛——还要有效 Kimi key 才有意义）
//   - 仅透传 api.kimi.com 一个上游，不可被滥用访问任意地址
import (
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	prefix := strings.Trim(os.Getenv("RELAY_PREFIX"), "/") // 如 r-9f3a2b
	const upstream = "https://api.kimi.com"
	client := &http.Client{Timeout: 90 * time.Second}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// 前缀校验：无匹配前缀一律 404（对外表现为"路径不存在"）
		if prefix != "" {
			if !strings.HasPrefix(r.URL.Path, "/"+prefix+"/") {
				http.NotFound(w, r)
				return
			}
		}
		target := upstream + strings.TrimPrefix(r.URL.Path, "/"+prefix)

		req, err := http.NewRequestWithContext(r.Context(), r.Method, target, r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		req.Header = r.Header.Clone()
		req.Host = "api.kimi.com" // TLS SNI + Host 对齐上游，伪装成直连

		resp, err := client.Do(req)
		if err != nil {
			http.Error(w, "upstream: "+err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		for k, vs := range resp.Header {
			for _, v := range vs {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
		log.Printf("%s %s -> %d", r.Method, r.URL.Path, resp.StatusCode)
	})

	log.Printf("kimi-relay listening :8080, prefix=%q upstream=%s", prefix, upstream)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
