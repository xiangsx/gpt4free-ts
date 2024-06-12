'use strict';
(self.webpackChunkddg = self.webpackChunkddg || []).push([
  [4368],
  {
    33919: (e, t, a) => {
      a.d(t, {
        A: () => c,
      });
      var n,
        r = a(73134);

      function l() {
        return (
          (l = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          l.apply(this, arguments)
        );
      }

      const c = function (e) {
        return r.createElement(
          'svg',
          l(
            {
              viewBox: '0 0 16 16',
              fill: 'none',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          n ||
            (n = r.createElement('path', {
              fill: 'currentColor',
              fillRule: 'evenodd',
              clipRule: 'evenodd',
              d: 'M9.975 1h.09a3.2 3.2 0 0 1 3.202 3.201v1.924a.754.754 0 0 1-.017.16l1.23 1.353A2 2 0 0 1 15 8.983V14a2 2 0 0 1-2 2H8a2 2 0 0 1-1.733-1H4.183a3.201 3.201 0 0 1-3.2-3.201V4.201a3.2 3.2 0 0 1 3.04-3.197A1.25 1.25 0 0 1 5.25 0h3.5c.604 0 1.109.43 1.225 1ZM4.249 2.5h-.066a1.7 1.7 0 0 0-1.7 1.701v7.598c0 .94.761 1.701 1.7 1.701H6V7a2 2 0 0 1 2-2h3.197c.195 0 .387.028.57.083v-.882A1.7 1.7 0 0 0 10.066 2.5H9.75c-.228.304-.591.5-1 .5h-3.5c-.41 0-.772-.196-1-.5ZM5 1.75v-.5A.25.25 0 0 1 5.25 1h3.5a.25.25 0 0 1 .25.25v.5a.25.25 0 0 1-.25.25h-3.5A.25.25 0 0 1 5 1.75ZM7.5 7a.5.5 0 0 1 .5-.5h3V9a1 1 0 0 0 1 1h1.5v4a.5.5 0 0 1-.5.5H8a.5.5 0 0 1-.5-.5V7Zm6 2v-.017a.5.5 0 0 0-.13-.336L12 7.14V9h1.5Z',
            })),
        );
      };
    },
    86444: (e, t, a) => {
      a.d(t, {
        P: () => E,
      });
      var n = a(4354),
        r = a(42895),
        l = a(73134),
        c = a(5049),
        o = a.n(c),
        s = a(56072),
        i = a(43734);
      const u = {
          buttonIcon: 'uuIDnYC4qmyFk5dsXOhr',
          xsmall: 'YZxymVMEkIDA0nZSt_Pm',
          small: 'Uz2BykKBXbObF11W1_5T',
          medium: 'wC9O6WeDiaJohlhBqhjL',
          large: 'FvyODV1d6aXw8C5t5HA_',
        },
        m = ['as', 'variant', 'size', 'className', 'children'];

      function d(e, t) {
        let {
            as: a = 'button',
            variant: l = 'primary',
            size: c = 'small',
            className: s = '',
            children: d,
          } = e,
          E = (0, r.A)(e, m);
        return React.createElement(
          i.A,
          (0, n.A)(
            {
              ref: t,
              as: a,
              variant: l,
              size: c,
              preserveIconSize: !0,
              className: o()(s, u.buttonIcon, u[c]),
            },
            E,
          ),
          d,
        );
      }

      d.proptypes = {
        as: s.PropTypes.oneOf(['button', 'a']),
        className: s.PropTypes.string,
        children: s.PropTypes.oneOfType([
          s.PropTypes.arrayOf(s.PropTypes.node),
          s.PropTypes.node,
        ]).isRequired,
        variant: s.PropTypes.oneOf([
          'primary',
          'secondary',
          'tertiary',
          'ghost',
          'customVariant',
        ]),
        size: s.PropTypes.oneOf([
          'xsmall',
          'small',
          'medium',
          'large',
          'customSize',
        ]),
      };
      const E = (0, l.forwardRef)(d);
    },
    26205: (e, t, a) => {
      a.d(t, {
        R: () => d,
        i: () => m,
      });
      var n = a(4354),
        r = a(42895),
        l = a(5049),
        c = a.n(l),
        o = a(73134);
      var s = a(78432);
      const i = ['children', 'className'],
        u = ['as', 'children', 'className'],
        m = (0, o.forwardRef)(function (e, t) {
          let { children: a, className: l } = e,
            c = (0, r.A)(e, i);
          return React.createElement(
            s.xL,
            (0, n.A)(
              {
                as: 'li',
                className: l,
                ref: t,
              },
              c,
            ),
            a,
          );
        }),
        d = (0, o.forwardRef)(function (e, t) {
          let { as: a = 'ul', children: l, className: o } = e,
            s = (0, r.A)(e, u);
          return React.createElement(
            a,
            (0, n.A)(
              {
                ref: t,
                className: c()(o, '_gnSTq5u2CM3HES5R4OE'),
              },
              s,
            ),
            l,
          );
        });
      d.Item = m;
    },
    84368: (e, t, a) => {
      a.r(t),
        a.d(t, {
          default: () => hn,
        }),
        a(23792),
        a(62953);
      var n = a(73134),
        r = a(65725),
        l = a(35009),
        c = a(60608),
        o = a(12100),
        s = (a(3362), a(72712), a(5049)),
        i = a.n(s),
        u = a(78432);
      const m = 8e3,
        d = [
          {
            model: 'gpt-3.5-turbo-0125',
            modelName: 'GPT-3.5',
            modelVariant: 'Turbo',
            modelStyleId: 'gpt-3-5-turbo',
            createdBy: 'OpenAI',
            moderationLevel: 'HIGH',
            isAvailable: !0,
            inputCharLimit: m,
            settingId: '3',
          },
          {
            model: 'gpt-4',
            modelName: 'GPT-4',
            modelVariant: null,
            modelStyleId: 'gpt-3-5-turbo',
            createdBy: 'OpenAI',
            moderationLevel: 'HIGH',
            isAvailable: !1,
            inputCharLimit: m,
            settingId: '4',
          },
          {
            model: 'claude-3-haiku-20240307',
            modelName: 'Claude 3',
            modelVariant: 'Haiku',
            modelStyleId: 'claude-3-haiku',
            createdBy: 'Anthropic',
            moderationLevel: 'HIGH',
            isAvailable: !0,
            inputCharLimit: m,
            settingId: '1',
          },
          {
            model: 'claude-3-sonnet-20240229',
            modelName: 'Claude 3',
            modelVariant: 'Sonnet',
            modelStyleId: 'claude-3-haiku',
            createdBy: 'Anthropic',
            moderationLevel: 'HIGH',
            isAvailable: !1,
            inputCharLimit: m,
            settingId: '2',
          },
          {
            model: 'meta-llama/Llama-3-70b-chat-hf',
            modelName: 'Llama 3',
            modelVariant: '70B',
            modelStyleId: 'llama-3',
            createdBy: 'Meta',
            createdByOverride: {
              token: 'DUCKCHAT_MODEL_BUILT_WITH',
              source: 'Meta Llama 3',
            },
            moderationLevel: 'MEDIUM',
            isAvailable: !0,
            isOpenSource: !0,
            inputCharLimit: m,
            settingId: '5',
          },
          {
            model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            modelName: 'Mixtral',
            modelVariant: '8x7B',
            modelStyleId: 'mixtral',
            createdBy: 'Mistral AI',
            moderationLevel: 'LOW',
            isAvailable: !0,
            isOpenSource: !0,
            inputCharLimit: m,
            settingId: '6',
          },
        ],
        E = (0, n.createContext)(null);

      function p({ children: e }) {
        const [t] = (0, n.useState)(() => d.filter((e) => e.isAvailable)),
          a = t[0],
          [r, l] = (function (e) {
            const t = (0, o.A)('settings'),
              a = t.get(e),
              [r, l] = (0, n.useState)(a);
            return [
              r,
              (0, n.useCallback)(
                (a) => {
                  l(a), t.set(e, a);
                },
                [e, t],
              ),
            ];
          })('kdcm'),
          c = t.find((e) => e.settingId === r),
          s = (0, n.useCallback)(
            (e) => {
              l(e.settingId);
            },
            [l],
          ),
          i = c || a,
          u = (0, n.useMemo)(
            () => ({
              availableModels: t,
              defaultModel: a,
              preferredModel: c,
              setPreferredModel: s,
              currentModel: i,
            }),
            [t, a, c, s, i],
          );
        return React.createElement(
          E.Provider,
          {
            value: u,
          },
          e,
        );
      }

      function R() {
        const e = (0, n.useContext)(E);
        if (!e)
          throw new Error(
            'useModels may only be used from within a (child of a) ModelsProvider',
          );
        return e;
      }

      var f = a(13461);
      const h = 'ERR_UNKNOWN',
        v = 'ERR_EMPTY_RESPONSE',
        C = 'ERR_INVALID_ACTION',
        g = 'ERR_RESPONSE_PARSING',
        y = {
          token: 'DUCKCHAT_ERROR_SERVICE_UNAVAILABLE',
        },
        _ = {
          token: 'DUCKCHAT_ERROR_VQD',
        },
        A = () => ({
          token: 'DUCKCHAT_ERROR_SERVICE_UNAVAILABLE',
        });

      function b(e) {
        return 'ERR_INVALID_VQD' === e || 'ERR_EXPIRED_VQD' === e;
      }

      var I = a(13185);
      a(38781);
      const O = (0, a(1961).d)(
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
          7,
        ),
        N = (() => {
          let e = 0;
          return () => (++e).toString();
        })();

      function T(e, t) {
        var a = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var n = Object.getOwnPropertySymbols(e);
          t &&
            (n = n.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            a.push.apply(a, n);
        }
        return a;
      }

      function S(e) {
        for (var t = 1; t < arguments.length; t++) {
          var a = null != arguments[t] ? arguments[t] : {};
          t % 2
            ? T(Object(a), !0).forEach(function (t) {
                (0, f.A)(e, t, a[t]);
              })
            : Object.getOwnPropertyDescriptors
            ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(a))
            : T(Object(a)).forEach(function (t) {
                Object.defineProperty(
                  e,
                  t,
                  Object.getOwnPropertyDescriptor(a, t),
                );
              });
        }
        return e;
      }

      const w = {
          messages: [],
          error: null,
          status: 'ready',
          VQD: {
            prev: '',
            curr: '',
          },
          abortController: null,
        },
        L = (e) => {
          if (e.length > 0) return e[e.length - 1];
        },
        M = (e, t) => {
          switch (t.type) {
            case 'USER_NEW_CONVERSATION': {
              var a;
              const { initialMessages: n, newModelConfig: r } = t.payload || {},
                l = n || w.messages,
                c = r || e.modelConfig;
              return (
                null === (a = e.abortController) || void 0 === a || a.abort(),
                S(
                  S({}, w),
                  {},
                  {
                    messages: l,
                    modelConfig: c,
                    status: 'ready',
                    ID: N(),
                  },
                )
              );
            }
            case 'SERVICE_VQD_INITIAL':
              return S(
                S({}, e),
                {},
                {
                  VQD: {
                    prev: t.payload,
                    curr: t.payload,
                  },
                },
              );
            case 'SERVICE_VQD_UPDATE':
              return S(
                S({}, e),
                {},
                {
                  VQD: {
                    prev: e.VQD.curr,
                    curr: t.payload,
                  },
                },
              );
            case 'USER_CONVERSATION_APPEND': {
              const a = t.payload,
                n = {
                  id: O(),
                  createdAt: new Date(),
                  content: a,
                  role: 'user',
                };
              return S(
                S({}, e),
                {},
                {
                  status: 'start_stream',
                  messages: [...e.messages, n],
                },
              );
            }
            case 'USER_CONVERSATION_REGENERATE_LAST': {
              const t = L(e.messages);
              if (!t) return e;
              let a = e.VQD,
                n = e.messages;
              return (
                'assistant' === t.role &&
                  ((n = n.slice(0, -1)),
                  (a = S(
                    S({}, a),
                    {},
                    {
                      curr: a.prev,
                    },
                  ))),
                S(
                  S({}, e),
                  {},
                  {
                    status: 'start_stream',
                    messages: n,
                    VQD: a,
                  },
                )
              );
            }
            case 'SERVICE_STREAM_LOADING': {
              const { abortController: a } = t.payload,
                n = {
                  id: O(),
                  createdAt: new Date(),
                  content: '',
                  role: 'assistant',
                };
              return S(
                S({}, e),
                {},
                {
                  status: 'loading',
                  messages: [...e.messages, n],
                  abortController: a,
                },
              );
            }
            case 'SERVICE_STREAM_UPDATE_MESSAGE': {
              const a = t.payload,
                n = e.messages,
                r = L(n);
              return r
                ? ((r.content += a),
                  S(
                    S({}, e),
                    {},
                    {
                      status: 'streaming',
                      messages: [...n],
                    },
                  ))
                : e;
            }
            case 'SERVICE_STREAM_CLOSED':
              return S(
                S({}, e),
                {},
                {
                  status: 'ready',
                  abortController: null,
                },
              );
            case 'USER_STREAM_ABORT': {
              var n;
              null === (n = e.abortController) || void 0 === n || n.abort();
              let t = e.messages;
              const a = L(t);
              return (
                a &&
                  !a.content &&
                  'assistant' === a.role &&
                  (t = t.slice(0, -1)),
                S(
                  S({}, e),
                  {},
                  {
                    status: 'ready',
                    messages: t,
                    abortController: null,
                  },
                )
              );
            }
            case 'SERVICE_ERROR_UPDATE': {
              var r, l;
              null === (r = e.abortController) || void 0 === r || r.abort();
              const { errorType: a, overrideCode: n } = t.payload;
              let o = 'error',
                s = e.messages;
              const i = L(s);
              if (
                (i &&
                  !i.content &&
                  'assistant' === i.role &&
                  (s = s.slice(0, -1)),
                'ERR_CONVERSATION_LIMIT' ===
                  (null === (l = e.error) || void 0 === l ? void 0 : l.type))
              )
                return S(
                  S({}, e),
                  {},
                  {
                    messages: s,
                  },
                );
              const u = ((e, t) =>
                  ({
                    ERR_UNKNOWN: y,
                    ERR_UPSTREAM: y,
                    ERR_USER_LIMIT: {
                      token: 'DUCKCHAT_ERROR_USER_LIMIT',
                      linkToHelpPages: !0,
                    },
                    ERR_SERVICE_UNAVAILABLE: y,
                    ERR_BAD_REQUEST: y,
                    ERR_SERVICE_LIMIT: {
                      token: 'DUCKCHAT_ERROR_SERVICE_LIMIT',
                      linkToHelpPages: !0,
                    },
                    ERR_CONVERSATION_LIMIT: {
                      token: 'DUCKCHAT_ERROR_CONVERSATION_LIMIT',
                    },
                    ERR_INPUT_LIMIT: {
                      token: 'DUCKCHAT_ERROR_INPUT_LIMIT',
                    },
                    ERR_MODEL_UNAVAILABLE: {
                      token: 'DUCKCHAT_ERROR_MODEL_UNAVAILABLE',
                      params: [null == t ? void 0 : t.modelName],
                    },
                    ERR_EMPTY_RESPONSE: y,
                    ERR_INVALID_ACTION: y,
                    ERR_RESPONSE_PARSING: y,
                    ERR_SERVICE_OFFLINE: y,
                    ERR_EXPIRED_VQD: _,
                    ERR_INVALID_VQD: _,
                    ERR_BN_LIMIT: {
                      token: 'DUCKCHAT_ERROR_BN_LIMIT',
                    },
                  }[e] || y))(a, e.modelConfig),
                m = {
                  type: a,
                  message: u,
                  overrideCode: n,
                };
              return (
                ('ERR_USER_LIMIT' === (c = m.type) ||
                  'ERR_SERVICE_LIMIT' === c ||
                  'ERR_CONVERSATION_LIMIT' === m.type ||
                  b(m.type) ||
                  'ERR_BN_LIMIT' === m.type) &&
                  (o = 'blocked'),
                S(
                  S({}, e),
                  {},
                  {
                    status: o,
                    messages: s,
                    error: m,
                    abortController: null,
                  },
                )
              );
            }
            case 'SERVICE_STATUS_OK':
              return e.error
                ? 'ERR_CONVERSATION_LIMIT' === e.error.type || b(e.error.type)
                  ? e
                  : S(
                      S({}, e),
                      {},
                      {
                        error: null,
                        status: 'ready',
                      },
                    )
                : e;
            default:
              return e;
          }
          var c;
        },
        k = (e, t) => {
          const [a, r] = (0, n.useReducer)(
            M,
            S(
              S({}, w),
              {},
              {
                ID: N(),
                modelConfig: e,
                messages: t || w.messages,
              },
            ),
          );
          return [a, r];
        };
      a(74423), a(27495), a(21699), a(5746), a(48408);
      const D = [
        'DuckDuckGo',
        'AI Chat',
        'Chat',
        'DuckDuckGo Chat',
        'chatGPT',
        'claude',
      ].map((e) => e.toLowerCase());
      var P = a(9620);

      function x(e, t) {
        var a = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var n = Object.getOwnPropertySymbols(e);
          t &&
            (n = n.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            a.push.apply(a, n);
        }
        return a;
      }

      const U = ['ERR_BN_LIMIT'],
        B = 3,
        H = async (e) => {
          var t;
          const [a, n, r, l] = e;
          r.current !== n && ((l.current = null), (r.current = n));
          const c = (function (e) {
              for (var t = 1; t < arguments.length; t++) {
                var a = null != arguments[t] ? arguments[t] : {};
                t % 2
                  ? x(Object(a), !0).forEach(function (t) {
                      (0, f.A)(e, t, a[t]);
                    })
                  : Object.getOwnPropertyDescriptors
                  ? Object.defineProperties(
                      e,
                      Object.getOwnPropertyDescriptors(a),
                    )
                  : x(Object(a)).forEach(function (t) {
                      Object.defineProperty(
                        e,
                        t,
                        Object.getOwnPropertyDescriptor(a, t),
                      );
                    });
              }
              return e;
            })(
              {
                'Cache-Control': 'no-store',
              },
              l.current
                ? {}
                : {
                    'x-vqd-accept': '1',
                  },
            ),
            o = await fetch(a, {
              headers: c,
            });
          if (!o.ok) {
            const e = await o.json();
            if (U.includes(e.type)) throw e;
            throw new Error(`${o.status}: ${o.statusText}`);
          }
          const s = o.headers.get('X-Vqd-4') || null,
            { status: i } =
              null !== (t = await o.json()) && void 0 !== t ? t : {};
          return {
            status: i,
            initialVqd: s,
          };
        };
      function V(e, t) {
        var a = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var n = Object.getOwnPropertySymbols(e);
          t &&
            (n = n.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            a.push.apply(a, n);
        }
        return a;
      }

      function Z(e) {
        for (var t = 1; t < arguments.length; t++) {
          var a = null != arguments[t] ? arguments[t] : {};
          t % 2
            ? V(Object(a), !0).forEach(function (t) {
                (0, f.A)(e, t, a[t]);
              })
            : Object.getOwnPropertyDescriptors
            ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(a))
            : V(Object(a)).forEach(function (t) {
                Object.defineProperty(
                  e,
                  t,
                  Object.getOwnPropertyDescriptor(a, t),
                );
              });
        }
        return e;
      }

      function j({ api: e, modelConfig: t, initialMessages: a }) {
        if (!e) throw new Error('Chat api not provided.');
        const r = `${e}/chat`,
          { fire: c } = (0, l.A)(),
          s = (function () {
            const {
                curState: { q: e },
              } = (0, o.A)('history'),
              t = (0, o.A)('openTypeState');
            if (!e) return null;
            try {
              var a, n;
              const r = new URLSearchParams(window.location.search),
                l =
                  null !== (a = Boolean(null == r ? void 0 : r.get('bang'))) &&
                  void 0 !== a &&
                  a,
                c =
                  'q' ===
                  (null === (n = t.byId.chat) || void 0 === n
                    ? void 0
                    : n.last),
                o = e.length <= 4,
                s = e.split(' ').length <= 1,
                i = D.includes(e.toLowerCase());
              return !l && (c || o || s || i) ? null : e;
            } catch (r) {
              return null;
            }
          })(),
          [i, u] = (0, n.useState)(null != s ? s : ''),
          [
            { ID: m, messages: d, modelConfig: E, error: p, status: R, VQD: f },
            y,
          ] = k(t, a),
          _ = (0, n.useCallback)(
            (e) => {
              y({
                type: 'SERVICE_VQD_INITIAL',
                payload: e,
              });
            },
            [y],
          ),
          { status: A, overrideCode: O } = (function ({
            id: e,
            api: t,
            onInitialVQD: a,
          }) {
            const r = `${t}/status`,
              l = (0, n.useRef)(null),
              c = (0, n.useRef)(null),
              o = (0, n.useRef)(0),
              s = (0, n.useRef)(!1),
              { data: { status: i, initialVqd: u } = {}, error: m } = (0, P.Ay)(
                [r, e],
                () => H([r, e, l, c]),
                {
                  onSuccess: () => {
                    (s.current = !1), (o.current = 0);
                  },
                  onErrorRetry: (e, t, a, n, { retryCount: r }) => {
                    (o.current = r),
                      r >= B ||
                        setTimeout(() => {
                          n({
                            retryCount: r,
                          });
                        }, 2e3);
                  },
                },
              );
            if (
              (u && u !== c.current && ((c.current = u), a(u)),
              s.current || (m && (!i || o.current >= B)))
            ) {
              if (((s.current = !0), U.includes(null == m ? void 0 : m.type))) {
                const e = m;
                return {
                  status:
                    'ERR_BN_LIMIT' === (null == e ? void 0 : e.type)
                      ? 'ERR_BN_LIMIT'
                      : 'ERR_SERVICE_UNAVAILABLE',
                  overrideCode: null == e ? void 0 : e.overrideCode,
                };
              }
              return {
                status: 'ERR_SERVICE_UNAVAILABLE',
              };
            }
            switch (i) {
              case null:
              case void 0:
                return {
                  status: 'IS_LOADING',
                };
              case '0':
                return {
                  status: 'OK',
                };
              case '1':
                return {
                  status: 'ERR_USER_LIMIT',
                };
              case '2':
                return {
                  status: 'ERR_SERVICE_LIMIT',
                };
              default:
                return {
                  status: 'ERR_SERVICE_UNAVAILABLE',
                };
            }
          })({
            id: m,
            api: e,
            onInitialVQD: _,
          });
        (0, n.useEffect)(() => {
          'IS_LOADING' !== A &&
            y(
              'OK' === A
                ? {
                    type: 'SERVICE_STATUS_OK',
                  }
                : {
                    type: 'SERVICE_ERROR_UPDATE',
                    payload: {
                      errorType: A,
                      overrideCode: O,
                    },
                  },
            );
        }, [m, A, y, O]);
        const N = (0, n.useCallback)(
          ({ newModelConfig: e } = {}) => {
            e
              ? c('dc_startNewChat', {
                  model: e.model,
                })
              : (u(''),
                c('dc_startNewChat', {
                  model: E.model,
                })),
              y({
                type: 'USER_NEW_CONVERSATION',
                payload: {
                  newModelConfig: e,
                },
              });
          },
          [y, c, E.model],
        );
        (0, n.useEffect)(() => {
          t &&
            t.model !== E.model &&
            N({
              newModelConfig: t,
            });
        }, [N, t, E]),
          (0, n.useEffect)(() => {
            p &&
              (b(p.type)
                ? c(
                    'dc_error',
                    `vqd_${(function (e) {
                      switch (e) {
                        case 'ERR_INVALID_VQD':
                          return 'invalid';
                        case 'ERR_EXPIRED_VQD':
                          return 'expired';
                        default:
                          return 'unknown';
                      }
                    })(p.type)}`,
                    {
                      msg: encodeURIComponent(p.type),
                    },
                  )
                : 'ERR_BN_LIMIT' === p.type
                ? c('dc_error', {
                    msg: encodeURIComponent(p.type),
                    o: encodeURIComponent(p.overrideCode || 'undefined'),
                  })
                : c('dc_error', {
                    msg: encodeURIComponent(p.type),
                  }));
          }, [p, c]),
          (0, n.useEffect)(() => {
            if ('start_stream' === R) {
              const e = new AbortController();
              y({
                type: 'SERVICE_STREAM_LOADING',
                payload: {
                  abortController: e,
                },
              }),
                (async function ({
                  api: e,
                  messages: t,
                  model: a,
                  VQD: n,
                  abortController: r,
                  onMessage: l,
                  onNewVQD: c,
                  onClose: o,
                  onError: s,
                }) {
                  const { signal: i } = r,
                    u = {
                      model: a,
                      messages: t
                        .filter(
                          (e) => 'assistant' === e.role || 'user' === e.role,
                        )
                        .map((e) => ({
                          role: e.role,
                          content: e.content,
                        })),
                    },
                    m = {
                      signal: i,
                      method: 'POST',
                      body: JSON.stringify(u),
                      headers: Z(
                        {
                          'Content-Type': 'application/json',
                          accept: 'text/event-stream',
                        },
                        n
                          ? {
                              'x-vqd-4': n,
                            }
                          : {},
                      ),
                    };
                  let d = '',
                    E = !1,
                    p = !1;
                  await (0, I.y)(
                    e,
                    Z(
                      Z(
                        Z(
                          {},
                          {
                            openWhenHidden: !0,
                          },
                        ),
                        m,
                      ),
                      {},
                      {
                        async onopen(e) {
                          (e.ok && e.headers.get('content-type') === I.o) ||
                            (await (async function (e) {
                              let t,
                                a = h;
                              try {
                                const n = await e.json();
                                (a = n.type || h), (t = n.overrideCode);
                              } catch (n) {
                                throw new Error(g);
                              }
                              throw new Error(a + (t ? `:${t}` : ''));
                            })(e)),
                            (d = e.headers.get('X-Vqd-4'));
                        },
                        onmessage(e) {
                          if (i.aborted) return;
                          if ((e.data || s(h), '[DONE]' === e.data)) return;
                          '[DONE][LIMIT_ENTITY]' === e.data &&
                            s('ERR_USER_LIMIT'),
                            '[DONE][LIMIT_CONVERSATION]' === e.data &&
                              s('ERR_CONVERSATION_LIMIT');
                          const t = JSON.parse(e.data);
                          if ('success' !== (null == t ? void 0 : t.action))
                            throw 'error' === (null == t ? void 0 : t.action)
                              ? new Error(t.type || h)
                              : new Error(C);
                          const a = null == t ? void 0 : t.message;
                          a && (d && !E && (c(d), (E = !0)), l(a), (p = !0));
                        },
                        onclose() {
                          p ? o() : s(v);
                        },
                        onerror(e) {
                          s(e.message || h);
                        },
                      },
                    ),
                  );
                })({
                  api: r,
                  messages: d,
                  model: E.model,
                  VQD: f.curr,
                  abortController: e,
                  onMessage: (e) => {
                    y({
                      type: 'SERVICE_STREAM_UPDATE_MESSAGE',
                      payload: e,
                    });
                  },
                  onNewVQD: (e) => {
                    y({
                      type: 'SERVICE_VQD_UPDATE',
                      payload: e,
                    });
                  },
                  onClose: () => {
                    y({
                      type: 'SERVICE_STREAM_CLOSED',
                    });
                  },
                  onError: (e) => {
                    throw new Error(e);
                  },
                }).catch((e) => {
                  if (e instanceof Error) {
                    var t;
                    const a =
                        null === (t = e.message) || void 0 === t
                          ? void 0
                          : t.split(':'),
                      n = a[0],
                      r = a[1];
                    y({
                      type: 'SERVICE_ERROR_UPDATE',
                      payload: {
                        errorType: n,
                        overrideCode: r,
                      },
                    });
                  }
                });
            }
          }, [f, r, R, y, d, E]);
        const T = (0, n.useCallback)(() => {
            y({
              type: 'USER_CONVERSATION_REGENERATE_LAST',
            });
          }, [y]),
          S = (0, n.useCallback)(() => {
            y({
              type: 'USER_STREAM_ABORT',
            });
          }, [y]),
          w = (0, n.useCallback)(() => {
            !i ||
              i.length > E.inputCharLimit ||
              ('blocked' !== R &&
                (0 === d.length && c('dc_sendFirstPrompt'),
                c('dc_sendPrompt'),
                y({
                  type: 'USER_CONVERSATION_APPEND',
                  payload: i,
                }),
                u('')));
          }, [i, E.inputCharLimit, R, d.length, c, y]);
        return {
          input: i,
          messages: d,
          chatStatus: R,
          error: p,
          startNewConversation: N,
          regenerateLastAnswer: T,
          stop: S,
          sendPrompt: w,
          handleInputChange: (e) => {
            u(e);
          },
        };
      }

      var K,
        F,
        G,
        Y,
        z = a(7014);

      function W() {
        return (
          (W = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          W.apply(this, arguments)
        );
      }

      const Q = function (e) {
        return n.createElement(
          'svg',
          W(
            {
              fill: 'none',
              viewBox: '0 0 16 16',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          K ||
            (K = n.createElement('path', {
              fill: '#DE5833',
              d: 'M2.466 6.81C3.923 4.335 5.895 2.735 6.709.5c2.363 1.97.894 5.66 3.193 5.847 2.298.187 1.788-2.796 1.788-2.796 1.647 1.893 2.658 4.242 2.796 6.356.199 3.04-1.708 5.593-6.5 5.593-5.218 0-8.114-4.28-5.52-8.69Z',
            })),
          F ||
            (F = n.createElement('path', {
              fill: '#9A3216',
              d: 'm6.71.5.32-.384a.5.5 0 0 0-.79.213L6.71.5ZM2.465 6.81l-.431-.253.43.254Zm9.224-3.26.377-.327a.5.5 0 0 0-.87.412l.493-.084Zm2.796 6.357-.499.032.499-.032ZM10.522.413a.5.5 0 1 0-.985.174l.985-.174Zm-.13 1.43a.5.5 0 0 0 .424-.906l-.424.906ZM6.239.329c-.377 1.035-1.029 1.94-1.804 2.926-.764.973-1.65 2.027-2.4 3.302l.862.507c.706-1.201 1.535-2.186 2.325-3.19C6 2.881 6.742 1.868 7.179.67l-.94-.34Zm.15.555c1.02.85 1.227 2.07 1.448 3.297.105.577.221 1.204.49 1.693.142.256.333.49.598.666.265.176.578.277.936.306l.081-.997a.953.953 0 0 1-.464-.142.866.866 0 0 1-.275-.317c-.175-.317-.27-.771-.382-1.386C8.612 2.846 8.373 1.236 7.03.116l-.64.768ZM9.86 6.846c.69.056 1.234-.126 1.628-.489.38-.349.565-.814.657-1.23.092-.419.1-.834.087-1.134a5.124 5.124 0 0 0-.048-.512l-.002-.01v-.004l-.493.084-.493.084v.003a1.165 1.165 0 0 1 .013.099c.009.07.018.174.024.299.01.252.002.572-.065.875-.067.307-.185.552-.357.71-.156.144-.41.265-.87.228l-.08.997Zm-7.826-.289C.655 8.902.708 11.28 1.877 13.081 3.04 14.871 5.243 16 7.987 16v-1c-2.475 0-4.329-1.011-5.271-2.463-.935-1.44-1.034-3.408.18-5.473l-.861-.507Zm9.277-2.678c1.587 1.822 2.545 4.07 2.675 6.06l.998-.065c-.146-2.237-1.209-4.688-2.918-6.651l-.755.656Zm2.675 6.06c.092 1.406-.303 2.65-1.228 3.546-.929.9-2.461 1.515-4.773 1.515v1c2.48 0 4.297-.661 5.47-1.797 1.177-1.14 1.636-2.694 1.529-4.329l-.998.065ZM9.537.587c.036.2.089.445.216.673.137.245.343.444.639.583l.424-.906a.38.38 0 0 1-.19-.165 1.172 1.172 0 0 1-.104-.36l-.985.175Z',
            })),
          G ||
            (G = n.createElement('path', {
              fill: '#FC3',
              d: 'M7.963 8.636c.917 1.652 2.45 2.542 2.45 4.067 0 1.526-.68 2.67-2.427 2.67-1.638 0-2.426-1.144-2.426-2.67 0-1.525 1.405-2.415 2.403-4.067Z',
            })),
          Y ||
            (Y = n.createElement('path', {
              fill: '#FF7A00',
              d: 'm7.963 8.636.437-.243a.5.5 0 0 0-.865-.016l.428.259Zm-.437.242c.486.876 1.153 1.577 1.616 2.152.486.605.77 1.093.77 1.673h1c0-.944-.48-1.664-.99-2.299C9.388 9.74 8.832 9.17 8.4 8.393l-.874.485Zm2.387 3.825c0 .7-.157 1.237-.446 1.591-.274.337-.724.579-1.48.579v1c.99 0 1.753-.33 2.255-.947.488-.599.67-1.396.67-2.223h-1Zm-1.927 2.17c-.693 0-1.151-.236-1.445-.585-.304-.361-.481-.902-.481-1.585h-1c0 .843.217 1.637.716 2.23.51.604 1.265.94 2.21.94v-1Zm-1.926-2.17c0-.592.266-1.085.724-1.681.435-.567 1.09-1.272 1.607-2.128l-.856-.517c-.481.797-1.028 1.363-1.545 2.036-.494.643-.93 1.358-.93 2.29h1Z',
            })),
        );
      };
      var q = a(86444);
      const J = {
        fireButtonContainer: 'PLGPl3juaaActKxdqp4r',
        fireButton: 'HzW8Rs4NQkNVJvWS0vQg',
        enabled: 'riV65AHDv5yHlmV5ehlM',
      };
      var X = a(4354),
        $ = a(42895),
        ee = a(7103);
      const te = [
        'children',
        'label',
        'aria-label',
        'DEBUG_STYLE',
        'placement',
        'className',
        'disable',
      ];

      function ae(e, t) {
        let {
            children: a,
            label: r,
            'aria-label': l,
            DEBUG_STYLE: c = !1,
            placement: o = 'bottom',
            className: s,
            disable: m,
          } = e,
          d = (0, $.A)(e, te);
        const [E, p] = (0, ee.fS)({
            DEBUG_STYLE: c,
          }),
          { isVisible: R } = p;
        return React.createElement(
          React.Fragment,
          null,
          (0, n.cloneElement)(a, E),
          m
            ? null
            : React.createElement(
                ee.oS,
                (0, X.A)(
                  {
                    className: i()('VEIpzniQ3cvFIMZ75KX9', s),
                  },
                  p,
                  {
                    isVisible: R,
                    label: React.createElement(
                      u.xL,
                      {
                        variant: 'label',
                      },
                      r,
                    ),
                    'aria-label': l,
                    position: ne(o),
                  },
                  d,
                  {
                    ref: t,
                  },
                ),
              ),
        );
      }

      function ne(e) {
        return function (t, a) {
          var n, r;
          let l = 0,
            c = 0;
          if (!t || !a)
            return {
              top: l,
              left: c,
            };
          switch (e) {
            case 'top':
              (l = t.top - a.height - 12),
                (c = t.left + t.width / 2 - a.width / 2);
              break;
            case 'left':
              (l = t.top + t.height / 2 - a.height / 2),
                (c = t.left - a.width - 12);
              break;
            case 'right':
              (l = t.top + t.height / 2 - a.height / 2), (c = t.right + 12);
              break;
            default:
              (l = t.bottom + 12), (c = t.left + t.width / 2 - a.width / 2);
          }
          const o = window.innerWidth,
            s = window.innerHeight;
          return (
            c < 0 ? (c = 0) : c + a.width > o && (c = o - a.width),
            l < 0 ? (l = 0) : l + a.height > s && (l = s - a.height),
            {
              top:
                l +
                ('scrollY' in window
                  ? window.scrollY
                  : (null === (n = window) || void 0 === n
                      ? void 0
                      : n.pageYOffset) || 0),
              left:
                c +
                ('scrollX' in window
                  ? window.scrollX
                  : (null === (r = window) || void 0 === r
                      ? void 0
                      : r.pageXOffset) || 0),
            }
          );
        };
      }

      const re = (0, n.forwardRef)(ae);

      function le({ enabled: e, onClick: t }) {
        const { translate: a } = (0, c.A)();
        return React.createElement(
          'div',
          {
            className: J.fireButtonContainer,
          },
          React.createElement(
            re,
            {
              label: a('DUCKCHAT_ACTION_CLEAR_CONVERSATION'),
              'aria-label': a('DUCKCHAT_ACTION_CLEAR_CONVERSATION'),
              placement: 'top',
            },
            React.createElement(
              q.P,
              {
                variant: 'secondary',
                size: 'medium',
                onClick: t,
                type: 'button',
                disabled: !e,
                className: i()(J.fireButton, {
                  [J.enabled]: e,
                }),
              },
              React.createElement(Q, null),
            ),
          ),
        );
      }

      var ce;

      function oe() {
        return (
          (oe = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          oe.apply(this, arguments)
        );
      }

      const se = function (e) {
        return n.createElement(
          'svg',
          oe(
            {
              fill: 'none',
              viewBox: '0 0 16 16',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          ce ||
            (ce = n.createElement('path', {
              fill: 'currentColor',
              d: 'M15.29 9.021c.87-.402.87-1.64 0-2.042L2.597 1.113A1.125 1.125 0 0 0 1 2.134v3.049a1 1 0 0 0 .757.97l5.917 1.483c.379.095.379.633 0 .728L1.757 9.847a1 1 0 0 0-.757.97v3.049c0 .821.851 1.366 1.597 1.021L15.29 9.021Z',
            })),
        );
      };
      var ie;

      function ue() {
        return (
          (ue = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          ue.apply(this, arguments)
        );
      }

      const me = function (e) {
          return n.createElement(
            'svg',
            ue(
              {
                width: 10,
                height: 10,
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg',
              },
              e,
            ),
            ie ||
              (ie = n.createElement('rect', {
                width: 10,
                height: 10,
                rx: 1,
                fill: 'currentColor',
              })),
          );
        },
        de = {
          sendButtonContainer: 'SLijmVGJIlWm8rC85Pz6',
          sendButton: 'aCZEC_jysXHQfHp97pov',
          send: 'DjuRm1IauTIaHQmiSM0Q',
          stop: 'Btpi_xKVImTaKXnMTkFH',
          forceHide: 'aGr8l7w20UfYtRo2xSFn',
        },
        Ee = ['status', 'enableSend', 'onStop'];

      function pe(e, t) {
        var a = Object.keys(e);
        if (Object.getOwnPropertySymbols) {
          var n = Object.getOwnPropertySymbols(e);
          t &&
            (n = n.filter(function (t) {
              return Object.getOwnPropertyDescriptor(e, t).enumerable;
            })),
            a.push.apply(a, n);
        }
        return a;
      }

      function Re(e) {
        for (var t = 1; t < arguments.length; t++) {
          var a = null != arguments[t] ? arguments[t] : {};
          t % 2
            ? pe(Object(a), !0).forEach(function (t) {
                (0, f.A)(e, t, a[t]);
              })
            : Object.getOwnPropertyDescriptors
            ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(a))
            : pe(Object(a)).forEach(function (t) {
                Object.defineProperty(
                  e,
                  t,
                  Object.getOwnPropertyDescriptor(a, t),
                );
              });
        }
        return e;
      }

      function fe(e) {
        let { status: t = 'ready', enableSend: a, onStop: r } = e,
          l = (0, $.A)(e, Ee);
        const { translate: o } = (0, c.A)(),
          s = (0, z.K)(),
          {
            icon: u,
            variant: m,
            buttonVariant: d,
            size: E,
            isDisabled: p,
            showButton: R,
          } = (function (e, t, a) {
            switch (e) {
              case 'loading':
              case 'streaming':
                return {
                  icon: React.createElement(me, null),
                  variant: 'stop',
                  buttonVariant: 'secondary',
                  size: 'small',
                  isDisabled: !1,
                  showButton: !0,
                };
              default:
                return Re(
                  Re({}, he),
                  {},
                  {
                    isDisabled: !t,
                    size: a ? 'small' : 'medium',
                    showButton: t || !a,
                  },
                );
            }
          })(t, a, !!s),
          f = o('DUCKCHAT_ACTION_SEND'),
          h = o('DUCKCHAT_ACTION_STOP'),
          v = 'send' === m ? f : 'stop' === m ? h : '',
          C = (0, n.useCallback)(
            (e) =>
              s
                ? e
                : React.createElement(
                    re,
                    {
                      label: v,
                      'aria-label': v,
                      placement: 'top',
                    },
                    e,
                  ),
            [s, v],
          );
        return React.createElement(
          'div',
          {
            className: i()(de.sendButtonContainer, {
              [de.forceHide]: !R,
            }),
          },
          C(
            React.createElement(
              q.P,
              (0, X.A)(
                {
                  ariaLabel: v,
                  variant: d,
                  size: E,
                  disabled: p,
                  type: 'submit',
                  className: i()(de.sendButton, de[m]),
                  onClick: (e) => {
                    p || ('stop' === m && r(e));
                  },
                },
                l,
              ),
              u,
            ),
          ),
        );
      }

      const he = {
          icon: React.createElement(se, null),
          variant: 'send',
          buttonVariant: 'primary',
          size: 'medium',
          isDisabled: !0,
          showButton: !0,
        },
        ve = [
          'SUGGEST_BLOG_POST_TITLE',
          'WRITE_EMAIL',
          'IDENTIFY_PRODUCT_BRANDS',
          'FIND_BETTER_WORD',
          'TEXT_TRANSLATE',
          'LOOKUP_BASIC_FACTS',
          'WRITE_CODE',
          'GET_COMPUTER_HELP',
          'IMPROVE_ARGUMENTS',
          'UNDERSTAND_TOPIC',
          'PREPARE_CONVERSATION',
          'PLAN_TRIP',
          'LEARN_SKILL',
          'CRAFT_RECIPE',
          'RECOMMEND_BOOK',
          'UNCOVER_PROS_CONS',
          'DEFINE_TERM',
          'CRITIQUE_WRITING',
          'PREPARE_PURCHASE',
          'COMPOSE_CARD',
        ].map(function (e) {
          return {
            brief: `DUCKCHAT_PROMPT_SUGGESTION_${e}_BRIEF`,
            full: `DUCKCHAT_PROMPT_SUGGESTION_${e}_FULL`,
          };
        });

      function Ce({ amount: e = 3, overrideSuggestions: t }) {
        return (0, n.useMemo)(() => {
          if (t) return t.slice(0, e);
          const a = [...ve],
            n = [];
          for (let t = 0; t < e; t++) {
            const e = Math.floor(Math.random() * a.length);
            n.push(a[e]), a.splice(e, 1);
          }
          return n;
        }, [e, t]);
      }

      var ge = a(71465),
        ye = a(85639);
      const _e = ['children', 'inline', 'className'],
        Ae = ['children', 'node'],
        be = ['children', 'node'],
        Ie = n.default.lazy(() =>
          Promise.all([a.e(5687), a.e(463)]).then(a.bind(a, 90463)),
        );

      function Oe({ children: e }) {
        const t = (0, n.useMemo)(
          () => ({
            code(e) {
              var t;
              let { children: a, inline: r, className: l } = e,
                c = (0, $.A)(e, _e);
              const o =
                null === (t = /language-(\w+)/.exec(String(l))) || void 0 === t
                  ? void 0
                  : t[1];
              return r
                ? n.default.createElement(
                    u.xL,
                    {
                      as: 'code',
                      variant: 'label',
                      className: i()('CNt3dNh9LHoy3oN1GFNL'),
                    },
                    a,
                  )
                : n.default.createElement(
                    n.Suspense,
                    {
                      fallback: n.default.createElement(
                        n.default.Fragment,
                        null,
                        a,
                      ),
                    },
                    n.default.createElement(
                      Ie,
                      (0, X.A)(
                        {
                          language: o || '',
                        },
                        c,
                      ),
                      String(a),
                    ),
                  );
            },
            table(e) {
              let { children: t, node: a } = e,
                r = (0, $.A)(e, Ae);
              return n.default.createElement(
                'div',
                (0, X.A)(
                  {
                    className: 'JAb78UGjd3lNs7Tcz5hv',
                  },
                  r,
                ),
                n.default.createElement('table', null, t),
              );
            },
            a(e) {
              let { children: t, node: a } = e,
                r = (0, $.A)(e, be);
              return n.default.createElement(
                u.xL,
                (0, X.A)(
                  {
                    as: 'a',
                    linkVariant: 'interactive',
                    rel: 'noopener',
                    target: '_blank',
                  },
                  r,
                ),
                t,
              );
            },
          }),
          [],
        );
        return n.default.createElement(
          'div',
          {
            className: i()('JXNYs5FNOplxLlVAOswQ'),
          },
          n.default.createElement(
            ge.$,
            {
              remarkPlugins: [ye.A],
              components: t,
            },
            e,
          ),
        );
      }

      const Ne = n.default.memo(Oe, (e, t) => e.children === t.children),
        Te = {
          assistantMessageBubble: 'OF5myNmIu5RFCewBifHU',
        };

      function Se({ children: e }) {
        return React.createElement(
          'div',
          {
            className: Te.assistantMessageBubble,
          },
          'string' == typeof e ? React.createElement(Ne, null, e) : e,
        );
      }

      const we = {
        anchor: 'MvD9nf9u4cPA7pJnVc1y',
        'gpt-3-5-turbo': 'IW3tHQ0dawfZAeUhIgIy',
        'claude-3-haiku': 'qFc5S0qBfWRGblB_58FO',
        'llama-3': 'AVDijn1KtEjYQm1JtONP',
        mixtral: 'yk_cU9RVcEV5knYzmO4C',
        status: 'bzsb0QW0AV7WKmWFSMB4',
        thinking: 'Dn56GtTFT8Upj2xVk9Hw',
        'dot-typing': 'SNHj0slFNHdTyivbTyno',
        sleeping: 'yZbgII2zQeIWlPWxAeRh',
        happy: 'RNIh9hzt6pthBuRf1FNu',
        unhappy: 'qhH9zonIScrmcLPoHA3d',
      };

      function Le({ status: e = 'default', modelStyleId: t = 'default' }) {
        return React.createElement(
          'div',
          {
            className: we.anchor,
          },
          React.createElement('div', {
            className: i()(we.status, we[e], we[t]),
          }),
        );
      }

      const Me = {
          messageLayout: 'kOMSj8TE0LBty6yatos7',
          fadeInAnimation: 'ISSaEtTgxPNLgzDJNvd9',
          status: 'HpHdg7qYZrZJzaPNs586',
          content: 'NRbLelmqTtXumYt6vkvs',
          actions: 'AHC2JZMPowBKMlQUGSmI',
        },
        ke = ['status', 'children', 'actions', 'className', 'contentExpanded'];

      function De(e) {
        let {
            status: t,
            children: a,
            actions: n,
            className: r = '',
            contentExpanded: l,
          } = e,
          c = (0, $.A)(e, ke);
        return React.createElement(
          'div',
          (0, X.A)(
            {
              className: i()(Me.messageLayout, r),
            },
            c,
          ),
          React.createElement(Pe, null, t),
          React.createElement(
            xe,
            {
              contentExpanded: l,
            },
            a,
          ),
          l ? null : React.createElement(Ue, null, n),
        );
      }

      function Pe({ children: e }) {
        return React.createElement(
          'div',
          {
            className: Me.status,
          },
          e,
        );
      }

      function xe({ contentExpanded: e, children: t }) {
        return React.createElement(
          'div',
          {
            className: i()(Me.content, {
              [Me.expanded]: !!e,
            }),
          },
          t,
        );
      }

      function Ue({ children: e }) {
        return React.createElement(
          'div',
          {
            className: Me.actions,
          },
          e,
        );
      }

      const Be = {
        emphasisMessage: 'I6CVUUO_cGkH7iSsYnTs',
        promptSuggestionCardsList: 'FMX8dqvgZtyN5QKD1Jqh',
        promptSuggestionCard: 'ROlPYEjb0zZ1B_pQEEOd',
        cardText: 'Yj5ZHbcBRWUubM6N4PUb',
        'gpt-3-5-turbo': 'VyHztU17MT87jYliNDA_',
        'claude-3-haiku': 'vQU_qDyXlIteMZJajyIz',
        'llama-3': 'Mn4bcDZEUs988b2TnSqa',
        mixtral: 'k7UwnlTjHPKn70DHuGLy',
      };

      function He({ onSuggestionClick: e, overrideSuggestions: t }) {
        const { translate: a } = (0, c.A)(),
          {
            currentModel: { modelStyleId: n },
          } = R(),
          r = Ce({
            amount: (0, z.K)() ? 3 : 6,
            overrideSuggestions: t,
          });
        return React.createElement(
          De,
          {
            status: React.createElement(Le, {
              status: 'default',
              modelStyleId: n,
            }),
          },
          React.createElement(
            Se,
            null,
            React.createElement(
              u.xL,
              {
                variant: 'body-large',
              },
              a('DUCKCHAT_NEW_CHAT_WELCOME_MESSAGE'),
            ),
            React.createElement(
              u.xL,
              {
                variant: 'body-large',
                className: Be.emphasisMessage,
              },
              a('DUCKCHAT_PRE_PROMPT_MESSAGE'),
            ),
            React.createElement(
              'div',
              {
                className: Be.promptSuggestionCardsList,
              },
              r.map((t) =>
                React.createElement(Ve, {
                  key: t.brief,
                  suggestionBrief: a(t.brief),
                  modelStyleId: n,
                  onClick: () => e(a(t.full)),
                }),
              ),
            ),
          ),
        );
      }

      function Ve({ suggestionBrief: e, modelStyleId: t, onClick: a }) {
        return React.createElement(
          'button',
          {
            className: i()(Be.promptSuggestionCard, Be[t]),
            onClick: a,
          },
          React.createElement(se, null),
          React.createElement(
            u.xL,
            {
              variant: 'body',
              className: Be.cardText,
            },
            e,
          ),
        );
      }

      const Ze = {
          inputFieldContainer: 'EVDhJYnZpFz_IE5x5BBB',
          chatCaption: 'wMCbbjc51JNoD_V3Lk0W',
          inputCharCounter: 'Ip4PaeQgjono1neSk27l',
          error: 'dpHkSAiz397z4qogW7RV',
          chatInput: 'JRDRiEf5NPKWK43sArdC',
        },
        je = ['onChange', 'charLimit', 'value'];

      function Ke(e, t) {
        let { onChange: a, charLimit: r = 50, value: l } = e,
          c = (0, $.A)(e, je);
        const o = (0, n.useRef)(null),
          s = (0, n.useRef)(0),
          [u, m] = (0, n.useState)(!1),
          [d, E] = (0, n.useState)(!1);

        function p() {
          const e = null == o ? void 0 : o.current;
          e &&
            ((e.style.height = 'auto'),
            (e.style.height = `${e.scrollHeight + 4}px`));
        }

        return (
          (0, n.useImperativeHandle)(t, () => o.current, []),
          (0, n.useEffect)(() => {
            const e = new ResizeObserver((e) => {
              const t = e[0];
              t.contentRect.width !== s.current &&
                (p(), (s.current = t.contentRect.width));
            });
            return o.current && e.observe(o.current), () => e.disconnect();
          }, []),
          (0, n.useEffect)(() => {
            p(), 0 === l.length && E(!1);
          }, [l]),
          (0, n.useEffect)(() => {
            u && E(!0);
          }, [u]),
          (0, n.useEffect)(() => {
            m(!!r && l.length > r);
          }, [r, l.length]),
          React.createElement(
            'div',
            {
              className: Ze.inputFieldContainer,
            },
            d
              ? React.createElement(Fe, {
                  charCount: l.length,
                  charLimit: r,
                  errorMaxChars: u,
                })
              : null,
            React.createElement(
              'textarea',
              (0, X.A)(
                {
                  ref: o,
                  name: 'user-prompt',
                  className: i()(Ze.chatInput, {
                    [Ze.error]: u,
                  }),
                  rows: 1,
                  type: 'text',
                  inputMode: 'text',
                  autoComplete: 'off',
                  value: l,
                  onChange: function (e) {
                    p(), a(e.currentTarget.value);
                  },
                },
                c,
              ),
            ),
          )
        );
      }

      function Fe({ charCount: e, charLimit: t, errorMaxChars: a }) {
        const { translate: n } = (0, c.A)();
        return React.createElement(
          'div',
          {
            className: Ze.chatCaption,
          },
          a
            ? React.createElement(
                u.xL,
                {
                  className: Ze.error,
                },
                n('DUCKCHAT_ERROR_MAX_CHARS'),
              )
            : null,
          React.createElement(
            u.xL,
            {
              className: Ze.inputCharCounter,
            },
            React.createElement(
              u.xL,
              {
                as: 'span',
                className: i()({
                  [Ze.error]: a,
                }),
              },
              e,
            ),
            '/',
            t,
          ),
        );
      }

      const Ge = (0, n.forwardRef)(Ke);
      var Ye,
        ze = a(33919);

      function We() {
        return (
          (We = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          We.apply(this, arguments)
        );
      }

      const Qe = function (e) {
        return n.createElement(
          'svg',
          We(
            {
              viewBox: '0 0 16 16',
              fill: 'none',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          Ye ||
            (Ye = n.createElement('path', {
              d: 'M6.507 1.674a6.5 6.5 0 0 1 6.97 2.826H11.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 .75-.75v-3.5a.75.75 0 0 0-1.5 0v1.586a8 8 0 1 0 .995 7.462.75.75 0 1 0-1.406-.524 6.5 6.5 0 1 1-7.582-8.6Z',
              fill: 'inherit',
            })),
        );
      };

      function qe({ children: e, tooltipLabel: t, onClick: a }) {
        return React.createElement(
          re,
          {
            label: t,
            'aria-label': t,
            placement: 'top',
          },
          React.createElement(
            q.P,
            {
              variant: 'ghostSecondary',
              size: 'small',
              onClick: a,
            },
            e,
          ),
        );
      }

      function Je({ content: e, onClick: t = () => null }) {
        const { translate: a } = (0, c.A)();
        return React.createElement(
          qe,
          {
            tooltipLabel: a('DUCKCHAT_TOOLTIP_COPY'),
            onClick: function (a) {
              navigator.clipboard.writeText(String(e)), t(a);
            },
          },
          React.createElement('i', null, React.createElement(ze.A, null)),
        );
      }

      function Xe({ onClick: e }) {
        const { translate: t } = (0, c.A)();
        return React.createElement(
          qe,
          {
            tooltipLabel: t('DUCKCHAT_TOOLTIP_REDO'),
            onClick: e,
          },
          React.createElement('i', null, React.createElement(Qe, null)),
        );
      }

      function $e({
        modelStyleId: e,
        content: t = '',
        status: a = 'ready',
        isLastPrompt: n = !1,
        onRetry: r,
      }) {
        const { translate: o } = (0, c.A)(),
          { fire: s } = (0, l.A)(),
          {
            anchorState: i,
            content: u,
            actions: m,
          } = (function (e, t = '', a) {
            switch (e) {
              case 'loading':
              case 'streaming':
                return {
                  content: t || a.streamingTxt,
                  anchorState: 'thinking',
                  actions: [],
                };
              case 'inactive':
                return {
                  content: t,
                  anchorState: 'sleeping',
                  actions: ['copy'],
                };
              default:
                return {
                  content: t,
                  anchorState: 'default',
                  actions: ['copy', 'retry'],
                };
            }
          })(a, t, {
            streamingTxt: o('DUCKCHAT_GENERATING_RESPONSE'),
          });

        function d() {
          s('dc_redoResponse'), r();
        }

        function E() {
          s('dc_copyResponse');
        }

        const p = m.map((e) => {
          switch (e) {
            case 'retry':
              return n
                ? React.createElement(Xe, {
                    key: 'retry',
                    onClick: d,
                  })
                : React.createElement(React.Fragment, null);
            case 'copy':
              return React.createElement(Je, {
                key: 'action1',
                content: u,
                onClick: E,
              });
            default:
              return React.createElement(React.Fragment, null);
          }
        });
        return React.createElement(
          De,
          {
            status: React.createElement(Le, {
              status: i,
              modelStyleId: e,
            }),
            actions: p,
          },
          React.createElement(Se, null, u),
        );
      }

      const et = {
        internalMessageBubble: 'Ga1o9ZdJfOZ_3FQtN1J1',
        fadeInAnimation: 'aAf5R01mPfYx1_K_zzID',
        unhappy: 'Te5h7TNQ9Af6CYhPEvuW',
      };

      function tt({ state: e, children: t }) {
        return React.createElement(
          'div',
          {
            className: i()(et.internalMessageBubble, et[e]),
          },
          React.createElement(
            u.xL,
            {
              variant: 'body-large',
            },
            t,
          ),
        );
      }

      function at({ error: e, status: t = 'ready' }) {
        const { translate: a, Translate: r } = (0, c.A)(),
          l = (function (e) {
            switch (e) {
              case 'error':
              case 'blocked':
                return 'unhappy';
              default:
                return 'default';
            }
          })(t),
          o = (0, n.useMemo)(() => {
            if (!e) return '';
            if ('ERR_BN_LIMIT' === e.type) {
              const t = 'aichat-error@duckduckgo.com',
                a = e.overrideCode || '',
                n = `mailto:${t}?subject=Error ${a}`;
              return React.createElement(
                React.Fragment,
                null,
                React.createElement(r, {
                  i18nkey: e.message.token,
                  as: 'span',
                  params: [
                    React.createElement(
                      u.xL,
                      {
                        as: 'code',
                        variant: 'label',
                        key: 'code',
                      },
                      a,
                    ),
                    React.createElement(
                      u.xL,
                      {
                        as: 'a',
                        variant: 'body-large',
                        linkVariant: 'link-02',
                        href: n,
                        target: '_blank',
                        key: 'email',
                        rel: 'noreferrer',
                      },
                      t,
                    ),
                  ],
                }),
              );
            }
            return React.createElement(
              React.Fragment,
              null,
              a(e.message.token, e.message.params),
              e.message.linkToHelpPages
                ? React.createElement(
                    React.Fragment,
                    null,
                    ' ',
                    React.createElement(
                      u.xL,
                      {
                        as: 'a',
                        variant: 'body-large',
                        linkVariant: 'link-02',
                        href: 'https://duckduckgo.com/duckduckgo-help-pages/aichat',
                        target: '_blank',
                      },
                      a('LEARN_MORE'),
                    ),
                  )
                : null,
            );
          }, [a, r, e]);
        return React.createElement(
          De,
          {
            status: React.createElement(Le, {
              status: l,
            }),
          },
          React.createElement(
            tt,
            {
              state: l,
            },
            o,
          ),
        );
      }

      var nt;

      function rt() {
        return (
          (rt = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          rt.apply(this, arguments)
        );
      }

      const lt = function (e) {
          return n.createElement(
            'svg',
            rt(
              {
                width: 12,
                height: 21,
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg',
              },
              e,
            ),
            nt ||
              (nt = n.createElement('path', {
                fill: 'currentColor',
                d: 'M3.072 9.154C12 10.127 12 15.564 12 21l.001-21C7.219 0 3.707 2.859 1.465 6.297c-.79 1.213.169 2.7 1.607 2.857Z',
              })),
          );
        },
        ct = n.default.memo(
          function ({ children: e }) {
            return n.default.createElement(
              'div',
              {
                className: 'fIM3huQs7e3rWJ37NWrB',
              },
              n.default.createElement(
                u.xL,
                {
                  variant: 'body-large',
                },
                e,
              ),
              n.default.createElement(
                'div',
                {
                  className: 'r0kKvvZpeUe_YToMaCCz',
                },
                n.default.createElement(lt, null),
              ),
            );
          },
          (e, t) => e.children === t.children,
        );

      function ot({ content: e }) {
        return React.createElement(
          De,
          {
            contentExpanded: !0,
          },
          React.createElement(ct, null, e),
        );
      }

      var st, it, ut, mt, dt, Et, pt;

      function Rt() {
        return (
          (Rt = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          Rt.apply(this, arguments)
        );
      }

      const ft = function (e) {
        return n.createElement(
          'svg',
          Rt(
            {
              fill: 'none',
              viewBox: '0 0 96 96',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          st ||
            (st = n.createElement('path', {
              fill: 'url(#chat-burn_svg__a)',
              d: 'M51 75.86c-.783.078-1.777.14-2.97.14-.588 0-1.148-.031-1.671-.083a17.804 17.804 0 0 1-2.036-.32c-1.25-.272-2.013-.582-2.013-.582a24.69 24.69 0 0 1-9.579-6.145 24.683 24.683 0 0 1-5.802-9.794 21.753 21.753 0 0 1 4.626-21.19 11.442 11.442 0 0 0 .844 5.068 14.282 14.282 0 0 0 3.23 4.407s-.763-2.022-.252-5.638l.027-.184c.086-.573.205-1.185.363-1.833.49-2.007 1.358-4.368 2.835-7.036A28.09 28.09 0 0 1 56.956 20a14.032 14.032 0 0 0-1.835 10.173c.558 1.863 1.296 3.291 2.151 4.946.831 1.608 1.773 3.43 2.767 6.072.053.118.105.237.155.356l.016.039.059.14a19.472 19.472 0 0 1 1.459 7.655c.34-2 1.022-3.926 2.019-5.693a14.097 14.097 0 0 1 7.341-6.06 21.457 21.457 0 0 0-1.688 10.43c.171.99.292 1.984.361 2.98.41-.025.823-.038 1.239-.038 1.58 0 2.843-1.336 2.609-2.899a33.127 33.127 0 0 0-.09-.566 17.31 17.31 0 0 1 1.375-8.256 4.148 4.148 0 0 0-5.21-5.554 18.242 18.242 0 0 0-6.531 4.079c-.797-1.883-1.546-3.332-2.185-4.568l-.01-.021c-.829-1.604-1.38-2.69-1.806-4.044a9.887 9.887 0 0 1 1.328-6.983 4.148 4.148 0 0 0-4.331-6.257 32.222 32.222 0 0 0-21.065 14.542 4.086 4.086 0 0 0-.11.187 36.906 36.906 0 0 0-1.691 3.454 4.148 4.148 0 0 0-4.8.983 25.893 25.893 0 0 0-5.51 25.224A28.83 28.83 0 0 0 40.98 78.948c.115.043.268.097.456.16.374.123.89.279 1.522.432a21.75 21.75 0 0 0 5.07.608c1.683 0 2.971-1.414 2.971-3.096v-1.193Z',
            })),
          it ||
            (it = n.createElement('path', {
              fill: 'url(#chat-burn_svg__b)',
              d: 'M69.761 51.038a29.76 29.76 0 0 0-.361-2.98 21.457 21.457 0 0 1 1.688-10.43 14.097 14.097 0 0 0-7.341 6.06 17.563 17.563 0 0 0-2.02 5.693 19.458 19.458 0 0 0-1.688-8.19c-.995-2.643-1.936-4.464-2.767-6.072-.855-1.655-1.593-3.083-2.152-4.946A14.035 14.035 0 0 1 56.956 20a28.073 28.073 0 0 0-18.354 12.67c-5.066 9.145-2.973 14.69-2.973 14.69a14.285 14.285 0 0 1-3.23-4.406 11.427 11.427 0 0 1-.845-5.069 21.746 21.746 0 0 0-4.625 21.191 24.683 24.683 0 0 0 15.38 15.94 10.428 10.428 0 0 1-5.542-8.668c-.16-5.018 2.452-8.193 5.033-11.33.97-1.18 1.936-2.353 2.749-3.617a14.437 14.437 0 0 0 3.23-10.798 14.69 14.69 0 0 1 5.69 8.998 16.56 16.56 0 0 1 .587 6.207 28.143 28.143 0 0 1-2.606 9.512s.155-.034.413-.15c2.38-7.823 9.426-13.615 17.898-14.132Z',
            })),
          ut ||
            (ut = n.createElement('path', {
              fill: 'url(#chat-burn_svg__c)',
              d: 'M51.863 65.17A20.001 20.001 0 0 0 51 71v4.86c-.783.078-1.777.14-2.97.14-3.295 0-5.72-.985-5.72-.985a10.426 10.426 0 0 1-5.543-8.667c-.16-5.018 2.452-8.193 5.033-11.33.97-1.18 1.936-2.353 2.749-3.617a14.436 14.436 0 0 0 3.23-10.798 14.691 14.691 0 0 1 5.69 8.998 16.56 16.56 0 0 1 .587 6.207 28.144 28.144 0 0 1-2.606 9.512s.155-.035.413-.15Z',
            })),
          mt ||
            (mt = n.createElement('path', {
              fill: '#557FF3',
              d: 'M61.41 80.52c.466.31.628.93.339 1.41l-2.344 3.876c-.454.752.204 1.676 1.06 1.475 4.71-1.107 15.4-3.773 18.663-5.897C83.84 78.918 87 74.372 87 69.173c0-7.828-7.163-14.174-16-14.174s-16 6.346-16 14.174c0 4.64 2.518 8.76 6.41 11.346Z',
            })),
          dt ||
            (dt = n.createElement('path', {
              fill: '#CCC',
              d: 'M92.501 59c.298 0 .595.12.823.354.454.468.454 1.23 0 1.698l-2.333 2.4a1.145 1.145 0 0 1-1.65 0 1.227 1.227 0 0 1 0-1.698l2.333-2.4c.227-.234.524-.354.822-.354h.005Zm-1.166 10.798h3.499c.641 0 1.166.54 1.166 1.2 0 .66-.525 1.2-1.166 1.2h-3.499c-.641 0-1.166-.54-1.166-1.2 0-.66.525-1.2 1.166-1.2Zm-1.982 8.754c.227-.234.525-.354.822-.354h.006c.297 0 .595.12.822.354l2.332 2.4c.455.467.455 1.23 0 1.697a1.145 1.145 0 0 1-1.65 0l-2.332-2.4a1.227 1.227 0 0 1 0-1.697Z',
            })),
          Et ||
            (Et = n.createElement('path', {
              fill: '#fff',
              d: 'M66 69a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm8 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
            })),
          pt ||
            (pt = n.createElement(
              'defs',
              null,
              n.createElement(
                'linearGradient',
                {
                  id: 'chat-burn_svg__a',
                  x1: 48.5,
                  x2: 48.5,
                  y1: 20,
                  y2: 76,
                  gradientUnits: 'userSpaceOnUse',
                },
                n.createElement('stop', {
                  stopColor: '#D7320F',
                }),
                n.createElement('stop', {
                  offset: 1,
                  stopColor: '#EF4926',
                }),
              ),
              n.createElement(
                'linearGradient',
                {
                  id: 'chat-burn_svg__b',
                  x1: 40.989,
                  x2: 59.214,
                  y1: 18.814,
                  y2: 76.276,
                  gradientUnits: 'userSpaceOnUse',
                },
                n.createElement('stop', {
                  stopColor: '#FFAA2C',
                  stopOpacity: 0.8,
                }),
                n.createElement('stop', {
                  offset: 1,
                  stopColor: '#FFAF38',
                }),
              ),
              n.createElement(
                'linearGradient',
                {
                  id: 'chat-burn_svg__c',
                  x1: 44.546,
                  x2: 58.231,
                  y1: 39.847,
                  y2: 74.804,
                  gradientUnits: 'userSpaceOnUse',
                },
                n.createElement('stop', {
                  stopColor: '#FFE565',
                  stopOpacity: 0.9,
                }),
                n.createElement('stop', {
                  offset: 1,
                  stopColor: '#FFE565',
                }),
              ),
            )),
        );
      };
      var ht = a(89035);

      function vt({ open: e, closeModal: t, clearConversation: a }) {
        const { translate: n } = (0, c.A)();
        return React.createElement(
          ht.Z,
          {
            open: e,
            onClickOutside: t,
            variant: 'bottomSheet',
          },
          React.createElement(
            ht.Z.Header,
            {
              illustration: React.createElement(ft, null),
              onClickClose: t,
            },
            n('DUCKCHAT_CLEAR_CONVERSATION_MODAL_TITLE'),
          ),
          React.createElement(
            ht.Z.Body,
            null,
            n('DUCKCHAT_CLEAR_CONVERSATION_DESCRIPTION'),
          ),
          React.createElement(ht.Z.FooterCTA, {
            primaryButtonProps: {
              children: n('DUCKCHAT_CLEAR_CONVERSATION_MODAL_BUTTON'),
              onClick: () => {
                t(), a();
              },
              variant: 'destructivePrimary',
            },
            secondaryButtonProps: {
              children: n('GENERIC_CANCEL_BUTTON'),
              onClick: t,
            },
          }),
        );
      }

      const Ct = {
        fireButton: '_3aS2LgdyYtbsw7pRKBY',
        enabled: 'HuCdNUEhc_uExAmWhjFl',
      };

      function gt({ clearConversation: e, enabled: t }) {
        const [a, r] = (0, n.useState)(!1);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            q.P,
            {
              variant: 'secondary',
              size: 'small',
              onClick: () => r(!0),
              type: 'button',
              className: i()(Ct.fireButton, {
                [Ct.enabled]: t,
              }),
            },
            React.createElement(Q, null),
          ),
          React.createElement(vt, {
            open: a,
            closeModal: () => r(!1),
            clearConversation: e,
          }),
        );
      }

      var yt, _t;

      function At() {
        return (
          (At = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          At.apply(this, arguments)
        );
      }

      const bt = function (e) {
        return n.createElement(
          'svg',
          At(
            {
              fill: 'none',
              viewBox: '0 0 16 16',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          yt ||
            (yt = n.createElement(
              'g',
              {
                fill: 'currentColor',
                clipPath: 'url(#info-16_svg__a)',
              },
              n.createElement('path', {
                d: 'M8.483 3.645c-.743 0-1.196.598-1.196 1.152 0 .67.51.89.963.89.831 0 1.181-.628 1.181-1.138 0-.642-.51-.904-.948-.904Zm.43 2.901-1.827.295c-.055.442-.136.89-.218 1.343-.157.877-.32 1.78-.32 2.723 0 .937.56 1.448 1.447 1.448 1.011 0 1.185-.635 1.224-1.21-.839.121-1.023-.257-.886-1.148.137-.891.58-3.451.58-3.451Z',
              }),
              n.createElement('path', {
                fillRule: 'evenodd',
                d: 'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z',
                clipRule: 'evenodd',
              }),
            )),
          _t ||
            (_t = n.createElement(
              'defs',
              null,
              n.createElement(
                'clipPath',
                {
                  id: 'info-16_svg__a',
                },
                n.createElement('path', {
                  fill: 'currentColor',
                  d: 'M0 0h16v16H0z',
                }),
              ),
            )),
        );
      };
      var It, Ot, Nt, Tt, St, wt, Lt, Mt, kt;

      function Dt() {
        return (
          (Dt = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          Dt.apply(this, arguments)
        );
      }

      const Pt = function (e) {
        return n.createElement(
          'svg',
          Dt(
            {
              fill: 'none',
              viewBox: '0 0 96 96',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          It ||
            (It = n.createElement('path', {
              fill: '#876ECB',
              d: 'M71 51c-11.046 0-20 8.954-20 20a3.06 3.06 0 0 1-2.225 2.953c-7.217 2.028-15.242 3.905-21.141 5.21a3.095 3.095 0 0 1-.932.067H22V75h2.376c.114-.224.261-.442.443-.65l7.28-8.32C25.34 60.904 21 52.941 21 44c0-13.478 9.863-24.732 23-27.4V16h7v.016C66.553 16.526 79 28.86 79 44c0 1.093-.065 2.17-.19 3.23-.269 2.25-2.3 3.77-4.565 3.77H71Z',
            })),
          Ot ||
            (Ot = n.createElement('path', {
              fill: '#C7B9EE',
              d: 'M71 51c-11.248 0-19.63 9.18-19.988 20.04-.014.43-.287.814-.697.947-8.443 2.744-19.908 5.456-27.68 7.177-2.799.62-4.704-2.657-2.816-4.814l5.161-5.898c1.145-1.31.929-3.306-.331-4.505C19.309 58.87 16 51.807 16 44c0-15.464 12.984-28 29-28s29 12.536 29 28c0 2.417-.317 4.763-.914 7H71Z',
            })),
          Nt ||
            (Nt = n.createElement('path', {
              fill: '#fff',
              fillRule: 'evenodd',
              d: 'M36 44a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm14 0a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm9 5a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
              clipRule: 'evenodd',
            })),
          Tt ||
            (Tt = n.createElement('path', {
              fill: '#CCC',
              d: 'M92.501 59c.298 0 .595.12.823.354.454.468.454 1.23 0 1.698l-2.333 2.4a1.145 1.145 0 0 1-1.65 0 1.227 1.227 0 0 1 0-1.698l2.333-2.4c.227-.234.524-.354.822-.354h.005Zm-1.166 10.798h3.499c.641 0 1.166.54 1.166 1.2 0 .66-.525 1.2-1.166 1.2h-3.499c-.641 0-1.166-.54-1.166-1.2 0-.66.525-1.2 1.166-1.2Zm-1.982 8.754c.227-.234.525-.354.822-.354h.006c.297 0 .595.12.822.354l2.332 2.4c.455.467.455 1.23 0 1.697a1.145 1.145 0 0 1-1.65 0l-2.332-2.4a1.227 1.227 0 0 1 0-1.697Z',
            })),
          St ||
            (St = n.createElement('rect', {
              width: 32,
              height: 32,
              x: 55,
              y: 55,
              fill: '#DE5833',
              rx: 16,
            })),
          wt ||
            (wt = n.createElement('path', {
              fill: '#fff',
              fillRule: 'evenodd',
              d: 'M71 57.044c-7.708 0-13.956 6.248-13.956 13.956 0 7.707 6.248 13.956 13.956 13.956 7.707 0 13.956-6.249 13.956-13.956 0-7.708-6.249-13.956-13.956-13.956ZM58.956 71c0-6.652 5.392-12.044 12.044-12.044 6.651 0 12.044 5.392 12.044 12.044 0 5.892-4.232 10.796-9.822 11.84-1.452-3.336-2.966-7.33-1.485-7.772-1.763-3.18-1.406-5.268 2.254-4.624h.005c.41.047.721.082.818.02.496-.315.189-7.242-4.114-8.182-3.96-4.9-7.73.688-5.817.306 1.529-.382 2.665-.03 2.612-.014-6.755.852-3.614 11.495-1.88 17.369a82.9 82.9 0 0 1 .606 2.116c-4.275-1.85-7.265-6.105-7.265-11.059Z',
              clipRule: 'evenodd',
            })),
          Lt ||
            (Lt = n.createElement('path', {
              fill: '#4CBA3C',
              d: 'M76.29 81.09c-.043.274-.137.457-.306.482-.319.05-1.747-.278-2.56-.587-.092.425-2.268.827-2.613.257-.79.682-2.302 1.673-2.619 1.465-.605-.396-1.175-3.45-.72-4.096.693-.63 2.15.055 3.171.417.347-.586 2.024-.808 2.372-.327.917-.697 2.448-1.68 2.597-1.501.745.897.839 3.03.678 3.89Z',
            })),
          Mt ||
            (Mt = n.createElement('path', {
              fill: '#FC3',
              fillRule: 'evenodd',
              d: 'M68.53 71.87c.311-2.216 4.496-1.523 6.368-1.772a12.11 12.11 0 0 0 3.05-.755c1.547-.636 1.811-.005 1.054.985-2.136 2.533-6.889.69-7.74 2-.248.388-.056 1.301 1.899 1.589 2.64.388 4.81-.468 5.079.05-.603 2.764-10.63 1.823-9.712-2.097h.001Z',
              clipRule: 'evenodd',
            })),
          kt ||
            (kt = n.createElement('path', {
              fill: '#14307E',
              d: 'M73.871 65.48c-.277-.6-1.7-.596-1.972-.024-.025.118.075.087.263.028.331-.104.938-.295 1.636.078.055.024.109-.033.073-.083Zm-6.954.143c-.264-.019-.693-.05-1.048.147-.52.222-.688.46-.788.624-.037.06-.181.054-.181-.017.035-.954 1.653-1.414 2.241-.821.072.089-.033.081-.224.067Zm6.447 3.199c-1.088-.005-1.088-1.684 0-1.69 1.09.006 1.09 1.685 0 1.69Zm-5.517-.26c-.021 1.294-1.92 1.294-1.94 0 .005-1.289 1.934-1.288 1.94 0Z',
            })),
        );
      };
      var xt = a(3330),
        Ut = a(65858);
      const Bt = {
        badge: 'gADc1vgzmPc4cvxu7yBr',
      };

      function Ht({ as: e = 'div', className: t, badgeText: a = 'NEW!' }) {
        return React.createElement(
          e,
          {
            className: i()(Bt.badge, t),
          },
          a,
        );
      }

      const Vt = {
        badge: 'WykTM0VMEgCt1hj7iB6x',
        betaBadge: 'JFTvuNWcJKrFLsvcHtP7',
        openSourceBadge: 'dd_tdhGU3BjyLS30t3rd',
      };

      function Zt({ className: e }) {
        const { translate: t } = (0, c.A)();
        return React.createElement(Ht, {
          as: 'span',
          className: i()(Vt.badge, Vt.betaBadge, e),
          badgeText: t('BETA'),
        });
      }

      function jt({ className: e }) {
        const { translate: t } = (0, c.A)();
        return React.createElement(Ht, {
          as: 'span',
          className: i()(Vt.badge, Vt.openSourceBadge, e),
          badgeText: t('DUCKCHAT_MODEL_OPEN_SOURCE'),
        });
      }

      const Kt = {
        infoModalDesktop: 'HaSbm9_boh7Un_Ok_Mer',
        infoModalLastUpdated: 's6kAMaDzR9EypQS5M5ov',
        betaBadge: 'dGiixv1LE3vIGtp5jy2D',
      };

      function Ft({ open: e, closeModal: t, onShareFeedbackClick: a }) {
        const n = (0, xt.b)() || 'en-EN',
          r = (0, z.K)(),
          { translate: l } = (0, c.A)(),
          o = new Date(2024, 5, 4),
          s = (0, Ut.jP)(n, o);
        return React.createElement(
          ht.Z,
          {
            open: e,
            onClickOutside: t,
            variant: r ? 'bottomSheet' : 'default',
            className: i()({
              [Kt.infoModalDesktop]: !r,
            }),
          },
          React.createElement(
            ht.Z.Header,
            {
              illustration: React.createElement(Pt, null),
              onClickClose: t,
            },
            React.createElement(
              React.Fragment,
              null,
              'DuckDuckGo AI Chat',
              React.createElement(Zt, {
                className: Kt.betaBadge,
              }),
            ),
          ),
          React.createElement(
            ht.Z.Body,
            null,
            l(
              'DUCKCHAT_AI_CHAT_INFO',
              'GPT-3.5',
              'Claude 3',
              'Llama 3',
              'Mixtral',
            ),
          ),
          React.createElement(ht.Z.FooterCTA, {
            primaryButtonProps: {
              children: l('HELP_PAGES'),
              onClick: t,
              variant: 'secondary',
              as: 'a',
              href: 'https://duckduckgo.com/duckduckgo-help-pages/aichat',
              target: '_blank',
              rel: 'noreferrer',
            },
            secondaryButtonProps: {
              variant: 'secondary',
              children: l('DUCKCHAT_ACTION_SHARE_FEEDBACK'),
              onClick: () => {
                t(), a();
              },
            },
          }),
          React.createElement(
            ht.Z.Footer,
            null,
            React.createElement(
              u.xL,
              {
                variant: 'caption',
              },
              React.createElement(
                u.xL,
                {
                  as: 'a',
                  variant: 'caption',
                  linkVariant: 'interactive',
                  href: 'https://duckduckgo.com/aichat/privacy-terms',
                  target: '_blank',
                  rel: 'noreferrer',
                },
                l('DUCKCHAT_PRIVACY_TERMS'),
              ),
              ' ',
              React.createElement(
                'span',
                {
                  className: Kt.infoModalLastUpdated,
                },
                '· ',
                l('DUCKCHAT_PRIVACY_LAST_UPDATED', s),
              ),
            ),
          ),
        );
      }

      function Gt() {
        const { translate: e } = (0, c.A)(),
          [t, a] = (0, n.useState)(!1),
          r = (0, n.useRef)(null),
          l = (0, o.A)('ReactLegacyProps');
        return (
          (0, n.useEffect)(() => {
            var n, c;
            if (t)
              r.current ||
                (r.current = l.createFeedbackModalView({
                  category: 'duckchat',
                  subtitleText: e('DUCKCHAT_FEEDBACK_FORM_SUBTITLE'),
                  showYesNo: !1,
                  onHide: () => {
                    a(!1);
                  },
                })),
                null === (n = r.current) ||
                  void 0 === n ||
                  null === (c = n.show) ||
                  void 0 === c ||
                  c.call(n);
            else if (r.current) {
              var o, s;
              null === (o = r.current) ||
                void 0 === o ||
                null === (s = o.hide) ||
                void 0 === s ||
                s.call(o);
            }
            return () => {
              var e, t;
              r.current &&
                (null === (e = (t = r.current).destroy) ||
                  void 0 === e ||
                  e.call(t),
                (r.current = null));
            };
          }, [l, t, e]),
          a
        );
      }

      const Yt = {
        root: 'avg8ZHlpLmmgEu961k9n',
      };

      function zt() {
        const { fire: e } = (0, l.A)(),
          [t, a] = (0, n.useState)(!1),
          r = Gt();
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            q.P,
            {
              variant: 'secondary',
              size: 'small',
              onClick: () => {
                e('dc_infoButtonClick'), a(!0);
              },
              type: 'button',
              className: Yt.root,
            },
            React.createElement(bt, null),
          ),
          React.createElement(Ft, {
            open: t,
            closeModal: () => a(!1),
            onShareFeedbackClick: () => r(!0),
          }),
        );
      }

      var Wt, Qt;

      function qt() {
        return (
          (qt = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          qt.apply(this, arguments)
        );
      }

      const Jt = function (e) {
        return n.createElement(
          'svg',
          qt(
            {
              fill: 'none',
              viewBox: '0 0 16 16',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          Wt ||
            (Wt = n.createElement(
              'g',
              {
                clipPath: 'url(#shield-multicolor-16_svg__a)',
              },
              n.createElement('path', {
                fill: '#4CBA3C',
                d: 'M8 15.5c.312 0 .578-.11.85-.248 2.039-1.034 3.817-1.935 5.006-3.713 1.109-1.658 1.675-4.027 1.643-7.879-.007-.778-.825-1.24-1.532-1.15-1.1.14-1.962.102-2.719-.133C10.063 2.01 9.23.507 8 .5v15Z',
              }),
              n.createElement('path', {
                fill: '#96E38A',
                d: 'M8 15.5c-.312 0-.578-.11-.85-.248-2.039-1.034-3.817-1.935-5.006-3.713C1.035 9.881.47 7.512.501 3.66c.007-.778.825-1.24 1.532-1.15 1.1.14 1.962.102 2.719-.133C5.937 2.01 6.77.507 8 .5v15Z',
              }),
              n.createElement('path', {
                fill: '#288419',
                fillRule: 'evenodd',
                d: 'M8.008 0a.51.51 0 0 0-.01 0 1.927 1.927 0 0 0-1.372.551c-.712.717-1.35 1.121-2.014 1.334-.666.212-1.452.263-2.518.128a1.974 1.974 0 0 0-1.427.368A1.617 1.617 0 0 0 0 3.656c-.033 3.891.536 6.38 1.727 8.161 1.262 1.887 3.143 2.84 5.14 3.853l.056.028.178.09a2.006 2.006 0 0 0 1.796 0l.178-.09.055-.028c1.998-1.013 3.879-1.966 5.14-3.853 1.192-1.781 1.76-4.27 1.728-8.16a1.618 1.618 0 0 0-.667-1.277 1.975 1.975 0 0 0-1.428-.367c-1.059.135-1.842.093-2.507-.113-.667-.207-1.312-.608-2.032-1.342A1.924 1.924 0 0 0 8.008 0ZM7.5 1.13a.802.802 0 0 0-.164.126c-.794.8-1.565 1.308-2.42 1.581-.849.271-1.792.314-2.947.169a.975.975 0 0 0-.7.174l-.221-.293.22.293a.62.62 0 0 0-.267.485c-.032 3.813.532 6.06 1.559 7.596 1.104 1.651 2.756 2.5 4.816 3.545l.124.062V1.13Zm1 13.738V1.138a.795.795 0 0 1 .151.12c.806.822 1.588 1.33 2.45 1.597.848.263 1.787.296 2.929.15a.975.975 0 0 1 .702.175.62.62 0 0 1 .267.485c.032 3.812-.532 6.06-1.559 7.596-1.104 1.651-2.756 2.5-4.816 3.545l-.124.062Z',
                clipRule: 'evenodd',
              }),
            )),
          Qt ||
            (Qt = n.createElement(
              'defs',
              null,
              n.createElement(
                'clipPath',
                {
                  id: 'shield-multicolor-16_svg__a',
                },
                n.createElement('path', {
                  fill: '#fff',
                  d: 'M0 0h16v16H0z',
                }),
              ),
            )),
        );
      };
      var Xt, $t, ea, ta, aa, na;

      function ra() {
        return (
          (ra = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          ra.apply(this, arguments)
        );
      }

      const la = function (e) {
          return n.createElement(
            'svg',
            ra(
              {
                width: 72,
                height: 72,
                fill: 'none',
                xmlns: 'http://www.w3.org/2000/svg',
              },
              e,
            ),
            Xt ||
              (Xt = n.createElement('path', {
                d: 'M53.25 38.25c-8.284 0-15 6.716-15 15v3.702c-1.595.55-2.625.726-2.625.726s-20.25-3.462-20.25-27.606V19.168l10.875.26 9.375-6.49 9.75 6.865 10.5-.635v10.904c0 3.043-.322 5.758-.884 8.178H53.25Z',
                fill: '#fff',
              })),
            $t ||
              ($t = n.createElement('path', {
                d: 'M53.25 38.25c-8.284 0-15 6.716-15 15v2.25l-2.625 3V13.327l9.75 6.476 10.11-.245v10.904c0 2.485-.37 5.144-1.065 7.788h-1.17Z',
                fill: '#F2F2F2',
              })),
            ea ||
              (ea = n.createElement('path', {
                d: 'M53.94 38.25c1.062-3.825 1.612-8.738 1.556-15.266-.003-.344-.175-.747-.605-1.07-.44-.33-1.072-.507-1.726-.424-3.345.426-6.135.335-8.675-.452-2.58-.8-4.906-2.32-7.28-4.738-.355-.362-.932-.62-1.601-.622-.669-.002-1.25.254-1.608.616-2.337 2.354-4.63 3.873-7.19 4.691-2.54.812-5.342.932-8.729.505-.654-.082-1.285.095-1.724.425-.43.323-.601.726-.604 1.07-.094 11.023 1.54 17.44 4.447 21.789 3.13 4.68 7.815 7.099 13.807 10.136l.138.07.006.003.005.002.002.002.367.185c.671.34 1.527.34 2.199 0l.37-.187.003-.002.002-.001.008-.004.134-.068 1.008-.512v2.293c0 1.165-.671 2.289-1.827 2.436a6.23 6.23 0 0 1-3.593-.61l-.373-.189-.004-.002-.002-.001-.003-.001-.001-.001-.336-.17c-5.762-2.92-11.305-5.73-15.027-11.294-3.524-5.271-5.176-12.59-5.08-23.907.014-1.62.828-3.077 2.1-4.034 1.261-.949 2.88-1.346 4.447-1.148 3.054.385 5.267.235 7.118-.357 1.845-.59 3.64-1.716 5.67-3.761 1.122-1.13 2.69-1.728 4.279-1.724 1.589.004 3.154.61 4.27 1.746 2.05 2.09 3.863 3.208 5.713 3.782 1.85.574 4.057.7 7.09.314 1.568-.2 3.19.196 4.453 1.146 1.273.956 2.088 2.415 2.102 4.036.043 5.08-.266 9.354-.938 13-.25 1.358-1.463 2.298-2.844 2.298H53.94Z',
                fill: '#CACACA',
              })),
            ta ||
              (ta = n.createElement('path', {
                d: 'M53.25 65.25c6.627 0 12-5.373 12-12s-5.373-12-12-12-12 5.373-12 12 5.373 12 12 12Z',
                fill: '#21C000',
              })),
            aa ||
              (aa = n.createElement('path', {
                d: 'M59.914 51.232a1 1 0 0 0 0-1.413l-1.394-1.394a1 1 0 0 0-1.414 0l-4.904 4.904a1 1 0 0 1-1.414 0l-1.394-1.395a1 1 0 0 0-1.414 0l-1.394 1.395a1 1 0 0 0 0 1.413l4.202 4.202a1 1 0 0 0 1.414 0l7.712-7.712Z',
                fill: '#fff',
              })),
            na ||
              (na = n.createElement('path', {
                d: 'M69.376 44.25a.86.86 0 0 1 .617.266.92.92 0 0 1 0 1.273l-1.75 1.8a.859.859 0 0 1-1.237 0 .92.92 0 0 1 0-1.274l1.75-1.8a.86.86 0 0 1 .616-.265h.004ZM68.501 52.349h2.624c.481 0 .875.405.875.9 0 .494-.394.9-.875.9h-2.624c-.48 0-.874-.406-.874-.9 0-.495.393-.9.874-.9ZM67.015 58.914a.86.86 0 0 1 .616-.266h.005a.86.86 0 0 1 .616.266l1.75 1.8a.92.92 0 0 1 0 1.273.86.86 0 0 1-1.238 0l-1.75-1.8a.92.92 0 0 1 0-1.273Z',
                fill: '#CCC',
              })),
          );
        },
        ca = 'https://duckduckgo.com/aichat/privacy-terms';

      function oa({ open: e, closeModal: t }) {
        const { translate: a } = (0, c.A)();
        return React.createElement(
          ht.Z,
          {
            open: e,
            onClickOutside: t,
            variant: 'bottomSheet',
          },
          React.createElement(
            ht.Z.Header,
            {
              illustration: React.createElement(la, null),
              onClickClose: t,
            },
            a('DUCKCHAT_PRIVACY_MODAL_TITLE'),
          ),
          React.createElement(
            ht.Z.Body,
            null,
            a('DUCKCHAT_ACTIVE_PRIVACY_DESCRIPTION'),
          ),
          React.createElement(ht.Z.FooterCTA, {
            primaryButtonProps: {
              children: a('DUCKCHAT_MODAL_GOT_IT'),
              onClick: t,
            },
            secondaryButtonProps: {
              children: a('DUCKCHAT_PRIVACY_MODAL_TERMS_PRIVACY'),
              onClick: () => {
                window.open(ca, '_blank'), t();
              },
            },
          }),
        );
      }

      function sa() {
        const [e, t] = (0, n.useState)(!1),
          { fire: a } = (0, l.A)();
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            q.P,
            {
              variant: 'secondary',
              size: 'small',
              onClick: () => {
                a('dc_activePrivacyButtonClick'), t(!0);
              },
              type: 'button',
            },
            React.createElement(Jt, null),
          ),
          React.createElement(oa, {
            open: e,
            closeModal: () => t(!1),
          }),
        );
      }

      var ia;

      function ua() {
        return (
          (ua = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          ua.apply(this, arguments)
        );
      }

      const ma = function (e) {
        return n.createElement(
          'svg',
          ua(
            {
              width: 12,
              height: 12,
              fill: 'none',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            e,
          ),
          ia ||
            (ia = n.createElement('path', {
              fillRule: 'evenodd',
              clipRule: 'evenodd',
              d: 'M.21 3.22a.7.7 0 0 1 1.02 0L6 8.19l4.77-4.97a.7.7 0 0 1 1.02 0 .772.772 0 0 1 0 1.06l-5.28 5.5a.7.7 0 0 1-1.02 0L.21 4.28a.772.772 0 0 1 0-1.06Z',
              fill: 'currentColor',
            })),
        );
      };
      var da = a(43734);
      const Ea = {
        root: 'AHrsI58GK_lguBKwmM47',
        'gpt-3-5-turbo': 'hufqsxfmjAWUxySu3Jz1',
        'claude-3-haiku': 'l6UVh1lrGJ6Hlz_kzKsS',
        'llama-3': 'VfG0RIsBGlItTYMwYuJ7',
        mixtral: 'cUm6acCaMMsbadq9VnQj',
      };
      var pa, Ra, fa, ha, va, Ca, ga, ya;

      function _a() {
        return (
          (_a = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          _a.apply(this, arguments)
        );
      }

      const Aa = function (e) {
          return n.createElement(
            'svg',
            _a(
              {
                fill: 'none',
                viewBox: '0 0 96 96',
                xmlns: 'http://www.w3.org/2000/svg',
              },
              e,
            ),
            pa ||
              (pa = n.createElement('path', {
                fill: '#876ECB',
                fillRule: 'evenodd',
                d: 'M33.784 23.823a6 6 0 0 0-4.242 7.349l11.387 42.5a6 6 0 0 0 7.349 4.243l26.853-7.195a6 6 0 0 0 4.242-7.349l-11.388-42.5a6 6 0 0 0-7.348-4.243l-26.853 7.195Zm16.273 7.028c2.123-.569 3.381-2.76 2.81-4.894-.572-2.134-2.757-3.402-4.88-2.834-2.123.57-3.381 2.76-2.81 4.894.572 2.134 2.757 3.403 4.88 2.834Z',
                clipRule: 'evenodd',
              })),
            Ra ||
              (Ra = n.createElement('path', {
                fill: '#63C853',
                fillRule: 'evenodd',
                d: 'M34 20a6 6 0 0 0-6 6v44a6 6 0 0 0 6 6h28a6 6 0 0 0 6-6V26a6 6 0 0 0-6-6H34Zm14 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
                clipRule: 'evenodd',
              })),
            fa ||
              (fa = n.createElement('path', {
                fill: '#FFD65C',
                fillRule: 'evenodd',
                d: 'M35.307 18.553a6 6 0 0 0-7.349 4.242L16.572 65.296a6 6 0 0 0 4.242 7.349l27.046 7.247a6 6 0 0 0 7.349-4.243l11.388-42.5a6 6 0 0 0-4.243-7.35l-27.046-7.246Zm10.676 14.249a4 4 0 1 0 2.07-7.728 4 4 0 0 0-2.07 7.728Z',
                clipRule: 'evenodd',
              })),
            ha ||
              (ha = n.createElement('path', {
                fill: 'url(#models_svg__a)',
                fillRule: 'evenodd',
                d: 'M46.65 20.376a4.68 4.68 0 0 0-1.027-.34c-.441-.087-.792-.075-1.045-.019-.246.055-.392.148-.48.232a.827.827 0 0 0-.223.416 1.46 1.46 0 0 0-.031.175l-3.875-1.038.023-.096a4.819 4.819 0 0 1 1.337-2.344 4.964 4.964 0 0 1 2.383-1.25c.879-.195 1.797-.176 2.689 0a8.989 8.989 0 0 1 2.599.974 10.77 10.77 0 0 1 2.288 1.713 10.551 10.551 0 0 1 1.753 2.244c.47.812.817 1.682.995 2.57.178.886.19 1.803-.028 2.68a4.82 4.82 0 0 1-1.336 2.345 4.966 4.966 0 0 1-2.384 1.25c-.879.195-1.796.176-2.688 0a8.627 8.627 0 0 1-1.819-.584 4.006 4.006 0 0 1-.603-1.287 3.996 3.996 0 0 1 .244-2.747c.278-.121.57-.211.871-.267.212.153.43.292.65.414a5 5 0 0 0 1.434.547c.441.087.792.075 1.045.019.246-.055.393-.148.48-.232a.828.828 0 0 0 .223-.416c.053-.216.07-.529-.011-.936a4.526 4.526 0 0 0-.535-1.353 6.556 6.556 0 0 0-1.088-1.388 6.77 6.77 0 0 0-1.685-1.207l-.056-.102-.1.027Z',
                clipRule: 'evenodd',
              })),
            va ||
              (va = n.createElement('path', {
                fill: '#CCC',
                fillRule: 'evenodd',
                d: 'm54.04 26.16-3.91-1.676a4.524 4.524 0 0 0-.55-1.438 6.553 6.553 0 0 0-1.09-1.388 6.77 6.77 0 0 0-1.432-1.075 5.002 5.002 0 0 0-1.435-.547c-.441-.087-.792-.075-1.045-.019-.246.055-.392.148-.48.232a.828.828 0 0 0-.223.416 1.344 1.344 0 0 0-.031.175l-3.875-1.038.023-.096a4.82 4.82 0 0 1 1.337-2.343 4.965 4.965 0 0 1 2.383-1.251c.879-.195 1.797-.176 2.689 0a8.991 8.991 0 0 1 2.599.974 10.77 10.77 0 0 1 2.288 1.713 10.551 10.551 0 0 1 1.753 2.244c.47.812.817 1.682.995 2.57.168.841.188 1.71.003 2.547Z',
                clipRule: 'evenodd',
              })),
            Ca ||
              (Ca = n.createElement('path', {
                fill: '#F9BE1A',
                fillRule: 'evenodd',
                d: 'M41.871 41.753a12.008 12.008 0 0 0-1.293 3.06c-1.715 6.402 2.084 12.982 8.485 14.697.644.172 1.29.29 1.932.353-2.683 4.486-8.104 6.845-13.404 5.425-6.402-1.715-10.2-8.295-8.485-14.697 1.543-5.758 7.02-9.41 12.765-8.838Z',
                clipRule: 'evenodd',
              })),
            ga ||
              (ga = n.createElement('path', {
                fill: '#F9BE1A',
                fillRule: 'evenodd',
                d: 'M43.285 44.038c-5.335-1.43-10.818 1.736-12.247 7.07-1.43 5.335 1.736 10.819 7.07 12.248 5.335 1.43 10.819-1.736 12.248-7.07 1.43-5.336-1.736-10.819-7.071-12.248Zm-16.111 6.036c2.001-7.469 9.678-11.901 17.146-9.9 7.469 2.001 11.901 9.678 9.9 17.146-2.001 7.469-9.678 11.901-17.147 9.9-7.468-2.001-11.9-9.678-9.9-17.146Z',
                clipRule: 'evenodd',
              })),
            ya ||
              (ya = n.createElement(
                'defs',
                null,
                n.createElement(
                  'linearGradient',
                  {
                    id: 'models_svg__a',
                    x1: 47,
                    x2: 49.5,
                    y1: 26,
                    y2: 26,
                    gradientUnits: 'userSpaceOnUse',
                  },
                  n.createElement('stop', {
                    stopColor: '#9C9C9C',
                  }),
                  n.createElement('stop', {
                    offset: 1,
                    stopColor: '#CCC',
                  }),
                ),
              )),
          );
        },
        ba = {
          modelCard: 'UxpK320s_KRKkSKj009L',
          'gpt-3-5-turbo': 'LqKLDWMmGallaLCviuA4',
          'claude-3-haiku': 'noSH43xbYgdlIU954Mqp',
          'llama-3': 'Jch2FiFReswjg7uDujsf',
          mixtral: 'tP7iEj1hkjO3X9Luzo1g',
          titleRow: 'xIQtZ25J4Yzu1HXBT5iI',
          modelRadio: 'HbSYK4qqtWrSpDMiSa5d',
          openSourceBadge: 'rn_He4oGwOVcJ7oDvlRv',
          modelMetadata: 'ZIcXHeaGsGd2miNdBmVS',
          metadataRow: 'tDjqHxDUIeGL37tpvoSI',
          secondary: 'Qkz3NtEsahvttVtU3oIB',
          selectRadio: 'nkNSS0XSiF0tUeyd720s',
          title: 'J58ouJfofMIxA2Ukt6lA',
        };

      function Ia({ model: e, checked: t, onClick: a }) {
        const { translate: n } = (0, c.A)(),
          {
            model: r,
            modelStyleId: l,
            modelName: o,
            modelVariant: s,
            createdBy: m,
            createdByOverride: d,
            moderationLevel: E,
            isAvailable: p,
            isOpenSource: R,
          } = e;
        return React.createElement(
          React.Fragment,
          null,
          React.createElement('input', {
            type: 'radio',
            name: 'model',
            value: r,
            id: r,
            checked: t,
            disabled: !p,
            className: ba.selectRadio,
          }),
          React.createElement(
            'label',
            {
              className: i()(ba.modelCard, ba[l]),
              htmlFor: r,
              onClick: a,
            },
            React.createElement(
              'div',
              {
                className: ba.titleRow,
              },
              React.createElement('div', {
                className: ba.modelRadio,
              }),
              React.createElement(
                u.xL,
                {
                  variant: 'body-emphasis',
                  className: ba.title,
                },
                o,
                ' ',
                React.createElement(
                  u.xL,
                  {
                    variant: 'body',
                    as: 'span',
                  },
                  s,
                ),
              ),
              R &&
                React.createElement(jt, {
                  className: ba.openSourceBadge,
                }),
            ),
            React.createElement(
              'div',
              {
                className: ba.modelMetadata,
              },
              React.createElement(
                Oa,
                null,
                n(`DUCKCHAT_MODEL_MODERATION_${E}`),
              ),
              React.createElement(
                Oa,
                {
                  variant: 'secondary',
                },
                d ? n(d.token, d.source) : n('DUCKCHAT_MODEL_CREATED_BY', m),
              ),
            ),
          ),
        );
      }

      function Oa({ children: e, variant: t }) {
        return React.createElement(
          u.xL,
          {
            variant: 'label',
            className: i()(ba.metadataRow, {
              [ba.secondary]: 'secondary' === t,
            }),
          },
          e,
        );
      }

      const Na = {
        modelModal: 'OiGPjZEsb7lQ0qZd5yml',
        header: 'FvjwdaahlLZvat_LLjvj',
        subheader: 'DBKMU26J5FqoTrRwkV8Q',
        disclaimer: 'HupiB1pFCBy86wfn4RhN',
      };

      function Ta({ open: e, onClose: t }) {
        const { translate: a } = (0, c.A)(),
          { fire: r } = (0, l.A)(),
          { availableModels: o, currentModel: s, setPreferredModel: i } = R(),
          m = (0, z.K)(),
          [d, E] = (0, n.useState)(s);
        return React.createElement(
          ht.Z,
          {
            open: e,
            className: Na.modelModal,
            onClickOutside: t,
            variant: m ? 'bottomSheet' : 'default',
          },
          React.createElement(
            ht.Z.Header,
            {
              onClickClose: t,
              illustration: m ? void 0 : React.createElement(Aa, null),
              className: Na.header,
            },
            a('DUCKCHAT_MODEL_MODAL_PICK_CHAT_MODEL'),
          ),
          React.createElement(
            u.xL,
            {
              variant: 'body',
              className: Na.subheader,
            },
            a('DUCKCHAT_MODEL_MODAL_SUBTITLE'),
          ),
          React.createElement(
            ht.Z.Body,
            null,
            React.createElement(
              'ul',
              null,
              o.map((e) =>
                React.createElement(
                  'li',
                  {
                    key: e.model,
                  },
                  React.createElement(Ia, {
                    model: e,
                    checked: (null == d ? void 0 : d.model) === e.model,
                    onClick: () => E(e),
                  }),
                ),
              ),
            ),
          ),
          s
            ? React.createElement(
                ht.Z.Footer,
                null,
                React.createElement(
                  u.xL,
                  {
                    className: Na.disclaimer,
                  },
                  a('DUCKCHAT_MODEL_MODAL_DISCLAIMER'),
                ),
              )
            : null,
          React.createElement(ht.Z.FooterCTA, {
            primaryButtonProps: {
              children: a('DUCKCHAT_MODEL_MODAL_START_NEW_CHAT'),
              onClick: () => {
                var e;
                d &&
                  (r('dc_successSwitchModel', {
                    model_selected: (e = d).model,
                    model_changed: e.model !== s.model,
                  }),
                  t(),
                  e.model !== s.model && i(e));
              },
              disabled: !d,
            },
            secondaryButtonProps: {
              children: a('GENERIC_CANCEL_BUTTON'),
              onClick: t,
            },
          }),
        );
      }

      function Sa() {
        const {
            currentModel: { modelName: e, modelStyleId: t },
          } = R(),
          { fire: a } = (0, l.A)(),
          [r, c] = (0, n.useState)(!1);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            da.A,
            {
              onClick: function () {
                a('dc_initSwitchModel'), c(!0);
              },
              className: i()(Ea.root, Ea[t]),
            },
            e,
            ' ',
            React.createElement(ma, null),
          ),
          React.createElement(Ta, {
            open: r,
            onClose: () => c(!1),
          }),
        );
      }

      const wa = {
        root: 'ZlwbWc0F7XQTZdLHpGzq',
        rightButtons: 'eh387cn8hSUxSdkLhwHB',
      };

      function La({
        clearConversation: e,
        fireButtonEnabled: t,
        className: a = '',
      }) {
        return React.createElement(
          'div',
          {
            className: i()(wa.root, a),
          },
          React.createElement(Sa, null),
          React.createElement(
            'div',
            {
              className: wa.rightButtons,
            },
            React.createElement(gt, {
              clearConversation: e,
              enabled: t,
            }),
            React.createElement(sa, null),
            React.createElement(zt, null),
          ),
        );
      }

      function Ma({
        api: e,
        initialMessages: t,
        overridePromptSuggestions: a,
      }) {
        const { translate: r } = (0, c.A)(),
          { fire: o } = (0, l.A)(),
          s = (0, z.K)(),
          { currentModel: m } = R(),
          {
            input: d,
            messages: E,
            chatStatus: p,
            error: f,
            startNewConversation: h,
            sendPrompt: v,
            regenerateLastAnswer: C,
            stop: g,
            handleInputChange: y,
          } = j({
            api: e,
            modelConfig: m,
            initialMessages: t,
          }),
          _ = (0, n.useRef)(null),
          A = (0, n.useRef)(null),
          b = (0, n.useRef)(new Map()),
          I = (0, n.useRef)(!1),
          O = 'blocked' === p || 'loading' === p || 'streaming' === p,
          N = (0, n.useMemo)(
            () =>
              E.reduce((e, t) => {
                if ('user' === t.role || 0 === e.length) {
                  const a = [t];
                  e.push(a);
                } else e[e.length - 1].push(t);
                return e;
              }, []),
            [E],
          );

        function T() {
          o('dc_clearConversation'), h();
        }

        function S(e) {
          var t;
          null == e ||
            null === (t = e.preventDefault) ||
            void 0 === t ||
            t.call(e),
            v();
        }

        (0, n.useEffect)(() => {
          var e, t;
          ('ready' !== p && 'error' !== p) ||
            !1 !== s ||
            null === (e = A.current) ||
            void 0 === e ||
            null === (t = e.focus) ||
            void 0 === t ||
            t.call(e);
        }, [p, s, m]),
          (0, n.useEffect)(() => {
            var e, t, a;
            if (
              ('ready' === p &&
                null !== (e = A.current) &&
                void 0 !== e &&
                e.value &&
                (null === (t = A.current) ||
                  void 0 === t ||
                  null === (a = t.select) ||
                  void 0 === a ||
                  a.call(t)),
              'start_stream' === p)
            ) {
              var n;
              const { offsetTop: e = 0 } = b.current.get('last') || {};
              null === (n = _.current) ||
                void 0 === n ||
                n.scrollTo({
                  top: e,
                  behavior: 'smooth',
                });
            }
          }, [p, s]),
          (0, n.useEffect)(() => {
            0 === E.length && (I.current = !1);
          }, [E.length]);
        const w = (0, n.useMemo)(
          () =>
            !f || ('error' !== p && 'blocked' !== p)
              ? null
              : React.createElement(at, {
                  status: p,
                  error: f,
                }),
          [f, p],
        );
        return React.createElement(
          'div',
          {
            className: 'PSL9z2mGqO2kEMN_ZOJl',
          },
          s
            ? React.createElement(La, {
                clearConversation: () => T(),
                fireButtonEnabled: E.length > 0 || !!f,
                className: 'pp8xushLDXOLEhia8vLM',
              })
            : null,
          React.createElement(
            'div',
            {
              className: 'e8hNVcv2hNmgdRTcd0UO',
              ref: _,
            },
            N.length
              ? N.map((e, t, a) => {
                  const n = a.length - 1 === t;
                  return React.createElement(
                    'div',
                    {
                      className: i()('ITr0_10CcfVlnL3y6VhK', {
                        uuRqArBWkjzP17UrOirJ: n,
                      }),
                      key: e[0].id,
                      ref: (e) => {
                        e && n && b.current.set('last', e);
                      },
                    },
                    e.map((e) =>
                      'user' === e.role
                        ? React.createElement(ot, {
                            key: e.id,
                            content: e.content,
                          })
                        : React.createElement($e, {
                            key: e.id,
                            modelStyleId: m.modelStyleId,
                            status: t < a.length - 1 ? 'inactive' : p,
                            content: e.content,
                            isLastPrompt: n,
                            onRetry: () => {
                              C();
                            },
                          }),
                    ),
                    n ? w : null,
                  );
                })
              : f
              ? w
              : React.createElement(He, {
                  onSuggestionClick: function (e) {
                    var t, a;
                    I.current || ((I.current = !0), o('dc_clickPrePrompt')),
                      y(e),
                      null === (t = A.current) ||
                        void 0 === t ||
                        null === (a = t.focus) ||
                        void 0 === a ||
                        a.call(t);
                  },
                  overrideSuggestions: a,
                }),
          ),
          React.createElement(
            'form',
            {
              className: 'ZmusGegMkG9sO4AhKft1',
              autoComplete: 'off',
              onSubmit: S,
            },
            React.createElement(
              'div',
              {
                className: 'IxVvmkiX8oMjeB3nBn90',
              },
              s
                ? null
                : React.createElement(le, {
                    onClick: T,
                    enabled: E.length > 0 || !!f,
                  }),
              React.createElement(Ge, {
                ref: A,
                value: d,
                charLimit: m.inputCharLimit,
                placeholder: r('DUCKCHAT_USER_PROMPT_PLACEHOLDER', m.modelName),
                onChange: (e) => y(e),
                onKeyPress: function (e) {
                  s ||
                    (null != e && e.shiftKey) ||
                    ('Enter' !== (null == e ? void 0 : e.key) &&
                      'Enter' !== e.code &&
                      13 !== (null == e ? void 0 : e.keyCode)) ||
                    S(e);
                },
                disabled: O,
              }),
              React.createElement(fe, {
                type: 'submit',
                status: p,
                enableSend: !O && '' !== d && d.length <= m.inputCharLimit,
                onStop: (e) => {
                  null == e || e.preventDefault(), o('dc_stopResponse'), g();
                },
              }),
            ),
            React.createElement(
              'div',
              {
                className: 'eRjZTOsvr6gqJe3E2Yc6',
              },
              React.createElement(
                u.xL,
                {
                  className: 'TtApESNnpBUUYUTugtHv',
                  variant: 'label',
                },
                r(
                  s ? 'DUCKCHAT_DISCLAIMER_SHORT' : 'DUCKCHAT_DISCLAIMER_LONG',
                  m.modelName,
                ),
              ),
            ),
          ),
        );
      }

      const ka = (0, n.memo)(Ma),
        Da = {
          duckChatLayout: 'ZXT5eRIexvqKrIEqmRyT',
          singleColumn: 'FU9OYY2BmtAXAuHEGcqe',
          twoColumn: 'TRGfUJB4ZBhJDYZfbgBu',
          left: 'cuhMRlbsijSWeq8UtkYx',
          right: 'xOVbtuSITLaEsCOYF1wI',
        };

      function Pa({ variant: e = 'singleColumn', style: t = {}, children: a }) {
        return n.default.createElement(
          'main',
          {
            style: t,
            className: i()(Da.duckChatLayout),
          },
          n.default.createElement(
            'div',
            {
              className: i()({
                [Da.singleColumn]: 'singleColumn' === e,
                [Da.twoColumn]: 'twoColumn' === e,
              }),
            },
            a,
          ),
        );
      }

      var xa;

      function Ua() {
        return (
          (Ua = Object.assign
            ? Object.assign.bind()
            : function (e) {
                for (var t = 1; t < arguments.length; t++) {
                  var a = arguments[t];
                  for (var n in a)
                    Object.prototype.hasOwnProperty.call(a, n) && (e[n] = a[n]);
                }
                return e;
              }),
          Ua.apply(this, arguments)
        );
      }

      (Pa.Left = function ({ children: e }) {
        return n.default.createElement(
          'section',
          {
            className: Da.left,
          },
          e,
        );
      }),
        (Pa.Right = function ({ children: e }) {
          return n.default.createElement(
            'section',
            {
              className: Da.right,
            },
            e,
          );
        }),
        a(89463);
      const Ba = function (e) {
          return n.createElement(
            'svg',
            Ua(
              {
                fill: 'none',
                viewBox: '0 0 16 16',
                xmlns: 'http://www.w3.org/2000/svg',
              },
              e,
            ),
            xa ||
              (xa = n.createElement('path', {
                fill: 'currentColor',
                fillRule: 'evenodd',
                d: 'M2.5 4.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2-3.5a3.5 3.5 0 1 0 3.355 4.5H14A.75.75 0 0 0 14 4H7.965A3.5 3.5 0 0 0 4.5 1Zm5 10.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm-1.355 1h-6.27a.75.75 0 0 1 0-1.5h6.16a3.5 3.5 0 1 1 .11 1.5Z',
                clipRule: 'evenodd',
              })),
          );
        },
        Ha = {
          aiAnchor: 'pv8xvIpMZQBmBIpchXeX',
          'gpt-3-5-turbo': 'eRNAqetZoVeQLc_460RV',
          'claude-3-haiku': 'wpsdLkoBvcCp67PCtqwu',
          'llama-3': 'MxTgboVsiMtxp0urqPLh',
          mixtral: 'fz_hmh3XoHfPxn7NnZl_',
          selectectAiMenuItem: 'Ep_BCXnW8tdA_qlT2esj',
          createdBy: 'rt1eZWwjnz4BgS6Jo8wX',
        };

      function Va({ modelStyleId: e }) {
        return React.createElement('div', {
          className: i()(Ha.aiAnchor, Ha[e]),
        });
      }

      function Za() {
        const { translate: e } = (0, c.A)(),
          {
            currentModel: { modelStyleId: t, modelName: a },
          } = R(),
          { fire: r } = (0, l.A)(),
          [o, s] = (0, n.useState)(!1);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(Ya, {
            label: a,
            prefix: React.createElement(Va, {
              modelStyleId: t,
            }),
            suffix: React.createElement(Ba, null),
            isClickable: !0,
            tooltipLabel: e('DUCKCHAT_MODEL_SELECT_TOOLTIP'),
            onClick: function () {
              r('dc_initSwitchModel'), s(!0);
            },
            className: Ha.selectectAiMenuItem,
          }),
          React.createElement(Ta, {
            open: o,
            onClose: function () {
              s(!1);
            },
          }),
        );
      }

      function ja() {
        const { translate: e } = (0, c.A)(),
          t = Gt();
        return React.createElement(
          da.A,
          {
            variant: 'secondary',
            onClick: () => t(!0),
          },
          e('DUCKCHAT_ACTION_SHARE_FEEDBACK'),
        );
      }

      const Ka = {
          menu: 'zOYb8r74bS2EZVcmDp2w',
          menuFooter: 'uNpNxLjmZNNGnlkDPAcl',
          footerItem: 'qNjf78V4epuMTYUpiIKw',
          menuItem: 'WWQzt6Y8Hx0MjxcaZ4o8',
          prefix: 'FB95Sd5oYq_0plmmzpe9',
          suffix: 'Kxj_hg0A26aBmvtwLEG9',
          default: 'Ie3JVvHhTnSHT5fH19XT',
          label: 'CBxVPI7h9OW4FzKHY0OK',
          menuTitle: 'SeMO2DqOjxoKrCHhR0yN',
          content: 'JlI311HV8eJ1zZp1ZcUv',
          description: 'uFAmeDntoVG2DIS1j5TG',
          clickable: 'tN6jXHD4obYiSUFu7wci',
          action: 'wnjr3XY6uMsd2g8xsr5k',
          success: 'UH64LCwQ5fkYueYEI3Lx',
          error: 'twic2Cy2HXQeUfMUWC2u',
          menuDisclaimer: 'BWeiuzzdWabVtAk7r74G',
          betaBadge: 'J9iuQJBRYd8EoYJOkoce',
        },
        Fa = [
          'prefix',
          'label',
          'description',
          'suffix',
          'className',
          'isClickable',
          'tooltipLabel',
          'onClick',
        ];

      function Ga() {
        const { translate: e } = (0, c.A)();
        return React.createElement(
          'div',
          {
            className: Ka.menu,
          },
          React.createElement(Ya, {
            label: React.createElement(
              React.Fragment,
              null,
              React.createElement(
                u.xL,
                {
                  as: 'span',
                  variant: 'body-large',
                  className: Ka.menuTitle,
                },
                'DuckDuckGo AI Chat',
              ),
              React.createElement(Zt, {
                className: Ka.betaBadge,
              }),
            ),
          }),
          React.createElement(Za, null),
          React.createElement(Ya, {
            label: e('DUCKCHAT_ACTIVE_PRIVACY_PROTECTION'),
            description: e('DUCKCHAT_ACTIVE_PRIVACY_DESCRIPTION'),
            prefix: React.createElement(Jt, null),
          }),
          React.createElement(
            'div',
            {
              className: Ka.menuFooter,
            },
            React.createElement(
              'div',
              {
                className: Ka.footerItem,
              },
              React.createElement(ja, null),
            ),
            React.createElement(
              'div',
              {
                className: Ka.footerItem,
              },
              React.createElement(za, null),
              React.createElement(
                da.A,
                {
                  variant: 'secondary',
                  as: 'a',
                  href: 'https://duckduckgo.com/duckduckgo-help-pages/aichat',
                  target: '_blank',
                  rel: 'noreferrer',
                },
                e('HELP_PAGES'),
              ),
            ),
          ),
        );
      }

      function Ya(e) {
        let {
            prefix: t,
            label: a,
            description: r,
            suffix: l,
            className: c = '',
            isClickable: o = !1,
            tooltipLabel: s,
            onClick: m,
          } = e,
          d = (0, $.A)(e, Fa);
        const E = o ? 'button' : 'div';
        return (0, n.useCallback)(
          (e) =>
            s
              ? React.createElement(
                  re,
                  {
                    label: s,
                    'aria-label': s,
                    placement: 'right',
                  },
                  e,
                )
              : e,
          [s],
        )(
          React.createElement(
            E,
            (0, X.A)(
              {
                className: i()(
                  Ka.menuItem,
                  {
                    [Ka.clickable]: o,
                  },
                  c,
                ),
                onClick: m,
              },
              d,
            ),
            t
              ? React.createElement(
                  'div',
                  {
                    className: Ka.prefix,
                  },
                  t,
                )
              : null,
            React.createElement(
              'div',
              {
                className: Ka.content,
              },
              React.createElement(
                u.xL,
                {
                  className: Ka.label,
                  variant: 'body-emphasis',
                },
                a,
              ),
              r
                ? React.createElement(
                    u.xL,
                    {
                      className: Ka.description,
                    },
                    r,
                  )
                : null,
            ),
            l
              ? React.createElement(
                  u.xL,
                  {
                    as: 'string' == typeof l ? 'p' : 'div',
                    className: Ka.suffix,
                  },
                  l,
                )
              : null,
          ),
        );
      }

      function za() {
        const [e, t] = (0, n.useState)(!1),
          { translate: a } = (0, c.A)(),
          r = Gt();
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(
            da.A,
            {
              variant: 'secondary',
              onClick: () => t(!0),
            },
            a('LEARN_MORE'),
          ),
          React.createElement(Ft, {
            open: e,
            closeModal: () => t(!1),
            onShareFeedbackClick: () => r(!0),
          }),
        );
      }

      const Wa = {
        onboarding: 'kPeGVLgWGtf6MTYeNMjX',
        title: 'taY2zeqsgvvYQR1rWhGn',
        screen: 'v3JBuY9eVN9l_joC8QVO',
        screenContent: 'G7rDHS2k8fykjYYMbnTg',
        withoutScroll: 'KpjP5cboYSi1O6I5ddwi',
        active: 'bhlopecbHY_vz5MJIuKm',
        previous: 'lphLQyEnf6r6IGCwA_2J',
        featuresList: 'UzkgCjTAZmfW3MeC4zl9',
        featureCard: 'H2QXKzoTCxYADSESmgFA',
        featureIcon: 'oev00NpSYTZrXCSyFa4K',
        chatPrivate: 'yhsp0N3nQqHQwrebuBky',
        mask: 'EBn7NYIPzYZVU6l5yvDG',
        models: 'efNLdAkbvRHRkPwGK3aI',
        modelsListWrapper: 'Fc8GCyWu3fIF3oRC6uFF',
        shadow: 'LkmkS0S2GEYjErvuRm0c',
        modelsList: 'x1h51tk23gwwiGsQtoMw',
        termsContainer: 'dRgIy84N5945NtLY87wQ',
        termsButtons: 'WkPsslBJWr7j_C9zxt94',
        blobs: 'ZCG5LGR37wHmpSe6qIq5',
        blob: 'muMzw9vLczO98DeDZSEO',
        blob1: 'R1dX85ghbvCXllmEqsFh',
        blob2: 'rkCC8kOwgjOb8xGSLkRw',
        blob3: 'qiOE5BNKE8sNSJHKw2RI',
        subtitle: 'Q6rr_mdD2009pPq1TQiZ',
      };
      var Qa = a(26205);
      const qa = {
          container: 'WxeXbAciZr1CC7Dfsql5',
          article: 'EfnGhOLZpAbNDfnSk3I6',
          title01: 'ct3Jnpf_cg3_IaQf8nT1',
          title02: 'yuHGPn7pzpPFwf8SDZy9',
          paragraph: 'VDYID4i2au8g5eYgxG3U',
          updateDate: 'IPqyvXWZQE7LXbLQR56w',
          hr: 'Svb4gGUusqqDRn7K8xm6',
          thirdPartySection: 'XtMzCTzSUYXmE0BSY8wD',
        },
        Ja = ['children'],
        Xa = ({ children: e }) =>
          React.createElement(
            u.xL,
            {
              as: 'h1',
              className: qa.title01,
              variant: 'title-02-emphasis',
            },
            e,
          ),
        $a = ({ children: e }) =>
          React.createElement(
            u.xL,
            {
              as: 'h2',
              className: qa.title02,
              variant: 'body-large',
            },
            e,
          ),
        en = ({ children: e }) =>
          React.createElement(
            u.xL,
            {
              className: qa.paragraph,
            },
            e,
          ),
        tn = ({ children: e, href: t }) =>
          React.createElement(
            u.xL,
            {
              className: qa.link,
              as: 'a',
              linkVariant: 'link-02',
              target: '_blank',
              href: t,
              rel: 'noreferrer',
              tabIndex: -1,
            },
            e,
          ),
        an = (e) => {
          let { children: t } = e,
            a = (0, $.A)(e, Ja);
          return React.createElement(
            'article',
            (0, X.A)(
              {
                className: qa.article,
              },
              a,
            ),
            t,
          );
        },
        nn = () =>
          React.createElement('hr', {
            className: qa.hr,
          });

      function rn({ showSection: e, isFocuseable: t }) {
        const a = (0, n.useRef)(null),
          r = (0, n.useRef)(null),
          l = (0, n.useRef)(null);
        return (
          (0, n.useEffect)(() => {
            if (e) {
              var t, n, c, o;
              const s =
                  'privacy-policy' === e
                    ? r.current
                    : 'terms-service' === e
                    ? l.current
                    : null,
                i =
                  (null !== (t = null == s ? void 0 : s.offsetTop) &&
                  void 0 !== t
                    ? t
                    : 0) -
                  (null !==
                    (n =
                      null === (c = a.current) || void 0 === c
                        ? void 0
                        : c.offsetTop) && void 0 !== n
                    ? n
                    : 0) -
                  15;
              null === (o = a.current) ||
                void 0 === o ||
                o.scrollTo({
                  top: i,
                  behavior: 'smooth',
                });
            }
          }, [e]),
          React.createElement(
            'div',
            {
              ref: a,
              className: qa.container,
              tabIndex: t ? 1 : -1,
            },
            React.createElement(
              'section',
              {
                ref: r,
              },
              React.createElement(
                an,
                null,
                React.createElement(Xa, null, 'Privacy Policy'),
                React.createElement(
                  en,
                  null,
                  'When you interact with DuckDuckGo AI Chat (“AI Chat”), responses (“Outputs”) are generated based on the text you submit (“Prompts”).',
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'We do not save or store your Prompts or Outputs.',
                ),
                React.createElement(
                  en,
                  null,
                  'Additionally, all metadata that contains personal information (for example, your IP address) is removed before sending Prompts to underlying model providers (for example, OpenAI, Anthropic).',
                ),
                React.createElement(
                  en,
                  null,
                  'If you submit personal information in your Prompts, it may be reproduced in the Outputs, but no one can tell (including us and the underlying model providers) whether it was you personally submitting the Prompts or someone else.',
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'We have agreements with model providers to further protect your privacy.',
                ),
                React.createElement(
                  en,
                  null,
                  'As noted above, we call model providers on your behalf so your personal information (for example, IP address) is not exposed to them. In addition, we have agreements in place with all model providers that further limit how they can use data from these anonymous requests that includes not using Prompts and Outputs to develop or improve their models as well as deleting all information received once it is no longer necessary to provide Outputs (at most within 30 days with limited exceptions for safety and legal compliance).',
                ),
                React.createElement(
                  en,
                  null,
                  'Our general ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://duckduckgo.com/privacy',
                    },
                    'Privacy Policy',
                  ),
                  ' also applies here. If there is a conflict with our general Privacy Policy, this AI Chat Privacy Policy applies.',
                ),
              ),
            ),
            React.createElement(nn, null),
            React.createElement(
              'section',
              {
                ref: l,
              },
              React.createElement(
                an,
                null,
                React.createElement(Xa, null, 'Terms of Service'),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'You retain all intellectual property rights in your Prompts and Outputs.',
                ),
                React.createElement(
                  en,
                  null,
                  'We claim no ownership of either your Prompts or Outputs. You grant us a limited intellectual property license permitting us only to process your Prompts and provide you the Outputs consistent with our Privacy Policy. You represent and warrant that you have all necessary rights and permissions to include any personal data or third-party content in your Prompts.',
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'Outputs may be inaccurate, incomplete, or otherwise unreliable.',
                ),
                React.createElement(
                  en,
                  null,
                  'By its very nature, AI Chat generates text with limited information. As such, Outputs that appear complete or accurate because of their detail or specificity may not be. For example, AI Chat cannot dynamically retrieve information and so Outputs may be outdated. You should not rely on any Output without verifying its contents using other sources, especially for professional advice (like medical, financial, or legal advice).',
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement($a, null, 'Outputs may be offensive.'),
                React.createElement(
                  en,
                  null,
                  "Outputs don't represent our views.",
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'AI Chat is only intended for and available to people who are age 13 or older.',
                ),
                React.createElement(
                  en,
                  null,
                  "If you are under the age of majority in your jurisdiction you must have your parent or legal guardian's permission to use AI Chat.",
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  "The models accessible through AI Chat are subject to the model provider's usage policies. Broadly, that means that using AI Chat for illegal, harmful, regulated, and sexually explicit purposes is prohibited.",
                ),
                React.createElement(
                  en,
                  null,
                  'AI Chat allows you to use models from leading model providers without being tracked. These model providers have usage policies, and our Terms therefore mirror those policies. For example, usage policies from ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://www.anthropic.com/legal/aup',
                    },
                    'Anthropic',
                  ),
                  ',',
                  ' ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://openai.com/policies/usage-policies',
                    },
                    'OpenAI',
                  ),
                  ' and',
                  ' ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://llama.meta.com/llama3/use-policy',
                    },
                    'Meta',
                  ),
                  ' apply to their respective models.',
                ),
                React.createElement(
                  en,
                  null,
                  'Accordingly, it is a violation of these Terms to use AI Chat for anything:',
                ),
                React.createElement(
                  Qa.R,
                  null,
                  React.createElement(
                    Qa.i,
                    {
                      className: qa.paragraph,
                    },
                    'Illegal or harmful to others, including generating hateful, harassing, or threatening content, or using Outputs for anything fraudulent or deceptive.',
                  ),
                  React.createElement(
                    Qa.i,
                    {
                      className: qa.paragraph,
                    },
                    "Violating other's rights or property, including privacy and intellectual property rights, creating spam, malware, computer viruses, or gaining access to computer systems without authorization.",
                  ),
                  React.createElement(
                    Qa.i,
                    {
                      className: qa.paragraph,
                    },
                    'Sexually explicit or obscene.',
                  ),
                  React.createElement(
                    Qa.i,
                    {
                      className: qa.paragraph,
                    },
                    'With high risk of physical or economic harm, including designing weapons, explosives, or other dangerous materials, or promoting multi-level marketing, gambling, or sports betting.',
                  ),
                  React.createElement(
                    Qa.i,
                    {
                      className: qa.paragraph,
                    },
                    'In a regulated area, including providing legal, financial, or medical advice or services, political campaigning or lobbying, determining eligibility for financial products or creditworthiness, housing (leases and home loans), employment, or more generally for governmental decision-making, such as law enforcement or immigration decisions.',
                  ),
                  React.createElement(
                    Qa.i,
                    {
                      className: qa.paragraph,
                    },
                    'Interfering with or negatively impacting AI Chat or other DuckDuckGo Services, including automated querying and developing or offering AI services, such as training an AI model.',
                  ),
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'Safety features created by model providers may try to prevent you from misusing AI Chat.',
                ),
                React.createElement(
                  en,
                  null,
                  'To avoid misuse, model providers embed safety mechanisms to block certain Prompts and the generation of certain Outputs.',
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'If you break the law or violate these Terms when using AI Chat for commercial purposes and we get sued, you may have to take responsibility.',
                ),
                React.createElement(
                  en,
                  null,
                  "You agree to indemnify and hold harmless DuckDuckGo, its affiliates, employees, and any other agents from and against any claims, losses, and expenses (including attorneys' fees) arising from or relating to your use of AI Chat for commercial purposes, including your subsequent use of any Outputs, your breach of these Terms, or violation of applicable law.",
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'We will notify you when these AI Chat Privacy Policy or Terms are updated.',
                ),
                React.createElement(
                  en,
                  null,
                  'We will notify you of changes by posting the modified version at',
                  ' ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://duckduckgo.com/aichat/privacy-terms',
                    },
                    'duckduckgo.com/aichat/privacy-terms',
                  ),
                  '. We will indicate the date it was last modified below with an update message on top if substantive changes were made. Continuing to access or use AI Chat after any changes constitutes your consent and agreement to any new terms.',
                ),
              ),
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'We may suspend or terminate your access to AI Chat at any time if you violate these Terms.',
                ),
                React.createElement(
                  en,
                  null,
                  'Our general ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://duckduckgo.com/terms',
                    },
                    'DuckDuckGo Terms of Service',
                  ),
                  ' also applies here. If there is a conflict with our general DuckDuckGo Terms of Service, these AI Chat Terms of Service apply.',
                ),
              ),
              React.createElement(nn, null),
              React.createElement(
                u.xL,
                {
                  className: qa.updateDate,
                },
                'Last updated: Jun 04, 2024',
              ),
            ),
            React.createElement(
              'section',
              {
                className: qa.thirdPartySection,
              },
              React.createElement(
                an,
                null,
                React.createElement(
                  $a,
                  null,
                  'Third Party Notices for AI Models:',
                ),
                React.createElement(
                  en,
                  null,
                  'The Llama 3 model available in AI Chat is provided under the',
                  ' ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://llama.meta.com/llama3/license/',
                    },
                    'Meta Llama 3 Community License Agreement.',
                  ),
                ),
                React.createElement(
                  en,
                  null,
                  'The Mistral AI models in AI Chat are provided under the',
                  ' ',
                  React.createElement(
                    tn,
                    {
                      href: 'https://docs.mistral.ai/getting-started/open_weight_models/#license',
                    },
                    'Apache 2.0 License',
                  ),
                  '.',
                ),
              ),
            ),
          )
        );
      }

      function ln({ initialScreen: e = 0 }) {
        const { fire: t } = (0, l.A)(),
          { availableModels: a, defaultModel: r, setPreferredModel: c } = R(),
          [o, s] = (0, n.useState)(r),
          [u, m] = (0, n.useState)({
            current: e,
            previous: e - 1,
          });

        function d() {
          m((e) =>
            2 === e.current
              ? e
              : {
                  current: e.current + 1,
                  previous: e.current,
                },
          );
        }

        function E(e) {
          return i()(Wa.screen, {
            [Wa.active]: u.current === e,
            [Wa.previous]: u.previous === e,
          });
        }

        return (
          (0, n.useEffect)(() => {
            const e = `dc_onboarding_impression_${u.current + 1}`;
            t(e);
          }, [u, t]),
          React.createElement(
            'div',
            {
              className: Wa.onboarding,
            },
            React.createElement(En, null),
            ' ',
            React.createElement(cn, {
              className: E(0),
              onAction: d,
              isFocuseable: 0 === u.current,
            }),
            React.createElement(on, {
              className: E(1),
              onAction: d,
              models: a,
              selectedModel: o,
              setSelectedModel: s,
              isFocuseable: 1 === u.current,
            }),
            React.createElement(sn, {
              className: E(2),
              onAction: function () {
                t('dc_onboarding_finish'), c(o);
              },
              isFocuseable: 2 === u.current,
            }),
          )
        );
      }

      function cn({ className: e, onAction: t, isFocuseable: a }) {
        const { translate: n } = (0, c.A)(),
          r = [
            {
              illustration: 'mask',
              text: n('DUCKCHAT_ONBOARDING_WELCOME_PRIVATE_ANONYMOUS_CHATS'),
            },
            {
              illustration: 'chatPrivate',
              text: n('DUCKCHAT_ONBOARDING_WELCOME_NO_AI_TRAINING'),
            },
            {
              illustration: 'models',
              text: n('DUCKCHAT_ONBOARDING_WELCOME_MULTIPLE_AI_MODELS'),
            },
          ];
        return React.createElement(
          'div',
          {
            className: e,
          },
          React.createElement(
            'div',
            {
              className: Wa.screenContent,
            },
            React.createElement(
              mn,
              null,
              n('DUCKCHAT_ONBOARDING_WELCOME_TITLE'),
            ),
            React.createElement(
              dn,
              null,
              n(
                'DUCKCHAT_AI_CHAT_INFO',
                'GPT-3.5',
                'Claude 3',
                'Llama 3',
                'Mixtral',
              ),
            ),
            React.createElement(
              'div',
              {
                className: Wa.featuresList,
              },
              r.map((e) =>
                React.createElement(un, {
                  key: e.text,
                  text: e.text,
                  illustration: e.illustration,
                }),
              ),
            ),
            React.createElement(
              da.A,
              {
                variant: 'primary',
                size: 'medium',
                onClick: t,
                type: 'button',
                tabIndex: a ? 1 : -1,
              },
              React.createElement(se, {
                style: {
                  width: '16px',
                  height: '16px',
                },
              }),
              n('DUCKCHAT_ONBOARDING_WELCOME_GET_STARTED'),
            ),
          ),
        );
      }

      function on({
        className: e,
        onAction: t,
        models: a,
        selectedModel: r,
        setSelectedModel: l,
        isFocuseable: o,
      }) {
        const { translate: s } = (0, c.A)(),
          u = (0, n.useRef)(null),
          m = (function (e) {
            const [t, a] = (0, n.useState)(!1),
              r = (0, n.useCallback)(() => {
                if (e.current) {
                  const t =
                    e.current.scrollHeight - e.current.scrollTop ===
                    e.current.clientHeight;
                  a(!t);
                }
              }, [e]);
            return (
              (0, n.useEffect)(() => {
                if (r)
                  return (
                    r(),
                    window.addEventListener('resize', r),
                    () => {
                      window.removeEventListener('resize', r);
                    }
                  );
              }, [r]),
              t
            );
          })(u);
        return React.createElement(
          'div',
          {
            className: e,
          },
          React.createElement(
            'div',
            {
              className: i()(Wa.screenContent, Wa.withoutScroll),
            },
            React.createElement(
              mn,
              null,
              s('DUCKCHAT_ONBOARDING_PICK_CHAT_MODEL_TITLE'),
            ),
            React.createElement(
              dn,
              null,
              s('DUCKCHAT_ONBOARDING_PICK_CHAT_MODEL_SUBTITLE'),
            ),
            React.createElement(
              'div',
              {
                className: i()(Wa.modelsListWrapper, {
                  [Wa.shadow]: m,
                }),
              },
              React.createElement(
                'ul',
                {
                  className: Wa.modelsList,
                  ref: u,
                },
                a.map((e) =>
                  React.createElement(
                    'li',
                    {
                      key: e.model,
                    },
                    React.createElement(Ia, {
                      model: e,
                      checked: (null == r ? void 0 : r.model) === e.model,
                      onClick: () => l(e),
                    }),
                  ),
                ),
              ),
            ),
            React.createElement(
              da.A,
              {
                variant: 'primary',
                size: 'medium',
                onClick: () => t(),
                as: 'button',
                tabIndex: o ? 1 : -1,
              },
              s('DUCKCHAT_ONBOARDING_PICK_CHAT_MODEL_NEXT'),
            ),
          ),
        );
      }

      function sn({ className: e, onAction: t, isFocuseable: a }) {
        const { translate: r, Translate: l } = (0, c.A)(),
          [o, s] = (0, n.useState)(),
          i = (e) => (t) => {
            t.preventDefault(), s(e);
          };
        return React.createElement(
          'div',
          {
            className: e,
          },
          React.createElement(
            'div',
            {
              className: Wa.screenContent,
            },
            React.createElement(mn, null, r('DUCKCHAT_ONBOARDING_TERMS_TITLE')),
            React.createElement(
              'div',
              {
                className: Wa.termsContainer,
              },
              React.createElement(rn, {
                showSection: o,
                isFocuseable: a,
              }),
            ),
            React.createElement(
              u.xL,
              null,
              React.createElement(l, {
                as: 'span',
                i18nkey: 'DUCKCHAT_TERMS_POLICY_AGREE_STATEMENT',
                params: [
                  React.createElement(
                    u.xL,
                    {
                      key: 'privacy',
                      as: 'a',
                      href: '#',
                      linkVariant: 'interactive',
                      onClick: i('privacy-policy'),
                      tabIndex: a ? 1 : -1,
                    },
                    r('DUCKCHAT_PRIVACY_POLICY'),
                  ),
                  React.createElement(
                    u.xL,
                    {
                      key: 'terms',
                      as: 'a',
                      href: '#',
                      linkVariant: 'interactive',
                      onClick: i('terms-service'),
                      tabIndex: a ? 1 : -1,
                    },
                    r('DUCKCHAT_TERMS_SERVICE'),
                  ),
                ],
              }),
            ),
            React.createElement(
              'div',
              {
                className: Wa.termsButtons,
              },
              React.createElement(
                da.A,
                {
                  variant: 'primary',
                  size: 'medium',
                  onClick: t,
                  as: 'button',
                },
                r('DUCKCHAT_ONBOARDING_TERMS_AGREE'),
              ),
            ),
          ),
        );
      }

      function un({ illustration: e, text: t }) {
        return React.createElement(
          'div',
          {
            className: Wa.featureCard,
          },
          React.createElement('div', {
            className: i()(Wa.featureIcon, Wa[e]),
          }),
          React.createElement(
            u.xL,
            {
              variant: 'body-large',
            },
            t,
          ),
        );
      }

      function mn({ children: e }) {
        return React.createElement(
          u.xL,
          {
            className: Wa.title,
            as: 'h3',
          },
          e,
        );
      }

      function dn({ children: e }) {
        return React.createElement(
          u.xL,
          {
            className: Wa.subtitle,
            variant: 'title-01',
          },
          e,
        );
      }

      function En() {
        return React.createElement(
          'div',
          {
            className: Wa.blobs,
          },
          React.createElement('div', {
            className: i()(Wa.blob, Wa.blob1),
          }),
          React.createElement('div', {
            className: i()(Wa.blob, Wa.blob2),
          }),
          React.createElement('div', {
            className: i()(Wa.blob, Wa.blob3),
          }),
        );
      }

      const pn = () => a.e(360).then(a.t.bind(a, 10360, 23));

      function Rn(e) {
        return React.createElement(p, null, React.createElement(fn, e));
      }

      function fn({
        initialMessages: e,
        overridePromptSuggestions: t,
        overrideTermsAcceptance: a = !1,
        style: r = {},
      }) {
        const { preferredModel: c, currentModel: s } = R(),
          { isDDGmacOS: i, isSafari: u } = (0, o.A)('device', [
            'isDDGmacOS',
            'isSafari',
          ]),
          { fire: m } = (0, l.A)(),
          d = !!c || a;
        return (
          (0, n.useEffect)(() => {
            d &&
              m('dc_startNewChat', {
                model: s.model,
              });
          }, [d]),
          (0, n.useEffect)(() => {
            (i || u) &&
              ((window.__forceSmoothScrollPolyfill__ = !0),
              pn().then((e) => {
                e.polyfill();
              }));
          }, [i, u]),
          d
            ? React.createElement(
                Pa,
                {
                  style: r,
                  variant: 'twoColumn',
                },
                React.createElement(
                  Pa.Left,
                  null,
                  React.createElement(Ga, null),
                ),
                React.createElement(
                  Pa.Right,
                  null,
                  React.createElement(ka, {
                    api: '/duckchat/v1',
                    initialMessages: e,
                    overridePromptSuggestions: t,
                  }),
                ),
              )
            : React.createElement(
                Pa,
                {
                  style: r,
                },
                React.createElement(ln, null),
              )
        );
      }

      function hn({
        isActive: e = !1,
        serpHeaderWrapperId: t = 'header_wrapper',
      }) {
        var a;
        const { translate: s } = (0, c.A)(),
          { fire: i } = (0, l.A)(),
          u = (0, o.A)('settings').get('ko'),
          [m] = (0, n.useState)(document.title),
          d = (0, n.useRef)(document.getElementById(t)),
          [E, p] = (0, n.useState)(() => {
            var e;
            return (
              (null === (e = d.current) || void 0 === e
                ? void 0
                : e.getBoundingClientRect().height) || 101
            );
          }),
          R = (0, n.useRef)(
            new ResizeObserver((e) => {
              for (const n of e) {
                var a;
                n.target.id === t &&
                  null !== (a = n.borderBoxSize) &&
                  void 0 !== a &&
                  null !== (a = a[0]) &&
                  void 0 !== a &&
                  a.blockSize &&
                  p(n.borderBoxSize[0].blockSize);
              }
            }),
          );
        (0, n.useEffect)(() => {
          i('dc_impression');
          const e = d.current,
            t = R.current;
          return (
            e && t.observe(e),
            () => {
              e && t.unobserve(e);
              const a = document.body;
              null == a || a.classList.remove('is-duckchat');
            }
          );
        }, [i]),
          (0, n.useEffect)(() => {
            const t = document.body;
            e
              ? (null == t || t.classList.add('is-duckchat'),
                null == t || t.classList.remove('out-duckchat'))
              : null != t &&
                t.classList.contains('is-duckchat') &&
                (null == t || t.classList.remove('is-duckchat'),
                null == t || t.classList.add('out-duckchat'));
          }, [e]),
          (0, n.useEffect)(() => {
            document.title = e ? 'AI Chat' : m;
          }, [e, m, s]);
        const f =
            null !== (a = window.CSS) &&
            void 0 !== a &&
            a.supports('height', '1dvh')
              ? `calc(100dvh - ${E}px)`
              : `calc(100vh - ${E}px)`,
          h = '1' == u ? `${E}px` : 0;
        return React.createElement(
          r.tH,
          {
            onError: (e, t) => {
              console.error(
                `${e.name}: ${e.message}\n${t.componentStack || ''}`,
              ),
                i('jse', 'react', 'dc', {
                  msg: encodeURIComponent(e.message),
                });
            },
            FallbackComponent: React.createElement(
              'div',
              {
                style: {
                  margin: '24px',
                },
              },
              React.createElement(at, {
                status: 'error',
                error: {
                  message: A(),
                  type: 'ERR_UNKNOWN',
                },
              }),
            ),
          },
          React.createElement(Rn, {
            style: {
              height: f,
              maxHeight: f,
              marginTop: h,
            },
          }),
        );
      }
    },
  },
]);
