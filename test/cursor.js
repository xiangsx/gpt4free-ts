class extends h {
    constructor(s, u, l, a, n, f, C) {
        super(s), this.q = u, this.r = l, this.s = a, this.t = n, this.u = f, this.n = () => {
        }, this.o = () => {
        }, this.p = () => {
        }, this.i = async () => {
            const v = this.g();
            if (v && new Date((0, S.decodeJwt)(v).exp * 1e3).getTime() - Date.now() > i) return;
            const g = this.f();
            if (g) {
                const k = {
                    method: "POST",
                    headers: {"content-type": "application/json"},
                    body: JSON.stringify({
                        grant_type: "refresh_token",
                        client_id: this.q.getCredentials().auth0ClientId,
                        refresh_token: g
                    })
                }, A = await (await fetch(`https://${this.q.getCredentials().auth0Domain}/oauth/token`, k)).json();
                this.j(A.access_token, g)
            }
        }, this.B = async () => {
            const v = this.g();
            if (!v) return;
            const k = await (await fetch(`${this.q.getBackendUrl()}/auth/stripe_profile`, {headers: {Authorization: `Bearer ${v}`}})).json();
            k ? this.k(k) : this.k()
        }, a.registerHandler({
            handleURL: async (v, g) => {
                if ((v.scheme === "control" || v.scheme === "cursor") && v.authority === "cursorAuth") {
                    const k = v.query, T = new URLSearchParams(k);
                    return this.w(T), !0
                }
                return !1
            }
        }), this.m = new Promise((v, g) => {
            this.n = v
        }), this.refreshAuthentication(), this.addSubscriptionChangedListener(v => {
            r.FREE
        })
    }

    v() {
        this.m = new Promise((s, u) => {
            this.n = s
        })
    }

    async w(s) {
        switch (s.get("route")) {
            case"login": {
                const l = s.get("refreshToken"), a = s.get("accessToken");
                l && a && (this.j(a, l), await this.B(), this.n());
                return
            }
            case"pay":
                await this.i(), this.n();
                return;
            default:
                return
        }
    }

    x(s) {
        const u = S.VSBuffer.wrap(s);
        return (0, S.encodeBase64)(u, !1, !0)
    }

    async y(s) {
        if (!crypto.subtle) throw new Error("'crypto.subtle' is not available so webviews will not work. This is likely because the editor is not running in a secure context (https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts).");
        const l = new TextEncoder().encode(s);
        return await crypto.subtle.digest("sha-256", l)
    }

    z(s) {
        this.u.publicLogCapture("$identify_cursordelimiter_" + s)
    }

    async login(s = "login") {
        this.v();
        const u = new Uint8Array(32);
        crypto.getRandomValues(u);
        const l = this.x(u), a = this.x(new Uint8Array(await this.y(l))), n = (0, E.generateUuid)();
        await this.r.open(`${this.q.getLoginUrl()}?challenge=${a}&uuid=${n}&mode=${s}`, {openExternal: !0});
        let f = 0;
        this.o(), this.t.info("Starting polling for login");
        const C = setInterval(async () => {
            this.t.info("Beginning of Login Poll");
            const v = await fetch(`${this.q.getPollingEndpoint()}?uuid=${n}&verifier=${l}`);
            if (this.t.info("Got login result", v.status), v.status == 404) return;
            const g = await v.json();
            this.t.info("Got login json", g), g !== void 0 && (g.authId && this.z(g.authId), g.accessToken && g.refreshToken && (this.j(g.accessToken, g.refreshToken), await this.B(), this.n(), clearInterval(C))), f++, f >= 30 && clearInterval(C)
        }, 200);
        this.o = () => {
            clearInterval(C)
        }, await Promise.race([new Promise(v => setTimeout(() => v(!1), 180 * 1e3))]), clearInterval(C), this.v()
    }

    async pay() {
        this.v(), await this.r.open(this.q.getCheckoutUrl(), {openExternal: !0}), this.p();
        const s = setInterval(async () => {
            await this.refreshAuthentication(), this.subscriptionKind() === r.PRO && clearInterval(s)
        }, 200);
        this.p = () => {
            clearInterval(s)
        }, await Promise.race([new Promise(u => setTimeout(() => u(!1), 3 * 60 * 1e3))]), clearInterval(s), this.v()
    }

    async signup() {
        await this.login("signup")
    }

    async settings() {
        await this.r.open(this.q.getSettingsUrl(), {openExternal: !0})
    }

    async refreshAuthentication() {
        await this.getAccessToken() || await this.i(), await this.B()
    }

    isAuthenticated() {
        const s = this.g(), u = this.f();
        return !!(s && u)
    }

    subscriptionKind() {
        return this.h() ? r.PRO : r.FREE
    }

    async getAuthenticationHeader() {
        const s = await this.getAccessToken();
        return s ? {Authorization: `Bearer ${s}`} : {}
    }

    async getAccessToken() {
        const s = this.g();
        if (s === void 0) return;
        const u = new Date, l = (0, S.decodeJwt)(s), a = new Date(l.exp * 1e3);
        if (a.getTime() < u.getTime() + i) return await this.i(), this.g();
        {
            const n = new Date(a.getTime() - i);
            let f;
            f && clearTimeout(f), f = setTimeout(() => {
                this.i()
            }, Math.max(n.getTime() - u.getTime(), 0))
        }
        return s
    }

    async getAccessTokenInterceptor() {
        let s;
        try {
            s = await this.getAccessToken()
        } catch {
            console.log("bad")
        }
        return s === void 0 ? null : l => async a => (a.header.set("Authorization", `Bearer ${s}`), await l(a))
    }
}
