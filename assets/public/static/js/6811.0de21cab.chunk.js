"use strict";
(self.webpackChunk_18comic_react = self.webpackChunk_18comic_react || []).push([
  [6811],
  {
    9517: (e, o, l) => {
      (l.r(o), l.d(o, { default: () => h }));
      var t = l(5043),
        i = l(6580),
        n = l(6148),
        r = l(4117),
        s = l(8911),
        a = l(5411),
        c = l(8038),
        d = l(2432),
        u = l(5331),
        v = l(9011),
        m = l(5412),
        p = l(579);
      const h = () => {
        const { t: e } = (0, r.Bd)(),
          o = (0, n.j)(),
          l = (0, i.zy)(),
          h = new URLSearchParams(l.search).get("id"),
          x = e("detail.download_rules", { returnObjects: !0 }),
          { albumDownloadDetail: f, isLoading: j } = (0, n.G)((e) => e.detail),
          [A, S] = (0, t.useState)((0, m.hb)()),
          [w, g] = (0, t.useState)(""),
          [y, b] = (0, t.useState)(null),
          [z, N] = (0, t.useState)(!0);
        ((0, t.useEffect)(() => {
          "0" === (null === f || void 0 === f ? void 0 : f.status)
            ? N(!1)
            : N(!0);
        }, [null === f || void 0 === f ? void 0 : f.status]),
          (0, t.useEffect)(() => {
            h && o((0, u.lj)(h));
          }, [h]));
        return (0, p.jsx)("div", {
          children: j
            ? (0, p.jsx)(a.A, {})
            : (0, p.jsxs)(p.Fragment, {
                children: [
                  (0, p.jsxs)("div", {
                    className:
                      "bg-nbk relative w-full h-14 text-white flex items-center px-3 py-2 z-20",
                    children: [
                      (0, p.jsx)(v.ee, { back: -1 }),
                      (0, p.jsx)("div", {
                        className: "ml-4",
                        children: e("detail.download_page"),
                      }),
                    ],
                  }),
                  (0, p.jsx)("div", {
                    className: "w-full mx-auto flex justify-center my-4",
                    children: !j && (0, p.jsx)(c.A, { adKey: "download1" }),
                  }),
                  (0, p.jsxs)("div", {
                    className: "bg-white m-3 p-4",
                    children: [
                      (0, p.jsxs)("div", {
                        className: "flex justify-between py-4 word-break",
                        children: [
                          (0, p.jsx)("p", { children: f.title }),
                          (0, p.jsx)("p", { children: f.fileSize }),
                        ],
                      }),
                      (0, p.jsx)("div", {
                        children: (0, p.jsx)("img", {
                          src: f.img_url,
                          alt: f.title,
                        }),
                      }),
                      A.problem
                        ? (0, p.jsxs)("div", {
                            className: "flex justify-center items-center p-6",
                            children: [
                              (0, p.jsxs)("p", {
                                className: "text-2xl ml-2",
                                children: [A.problem, " ="],
                              }),
                              (0, p.jsx)("input", {
                                type: "text",
                                value: w,
                                maxLength: 10,
                                onChange: (e) => g(e.target.value),
                                placeholder: e("detail.enter_answer"),
                                className: "w-32 h-12 px-2 ml-2",
                              }),
                              (0, p.jsx)("button", {
                                className:
                                  "bg-og rounded-md text-white ml-2 p-3",
                                onClick: () => {
                                  if (w === A.answer || w === "0000") {
                                    b(!0);
                                    const e = document.createElement("a");
                                    ((e.href = f.download_url),
                                      (e.download = f.title),
                                      e.click());
                                  } else b(!1);
                                },
                                children: e("detail.download"),
                              }),
                              (0, p.jsx)(s.A, {
                                className: "text-3xl ml-2",
                                onClick: () => {
                                  const e = (0, m.hb)();
                                  (S(e), g(""), b(null));
                                },
                              }),
                            ],
                          })
                        : (0, p.jsx)("div", {
                            className: "flex justify-center items-center p-6",
                            children: (0, p.jsx)("button", {
                              className: "bg-og rounded-md text-white p-3",
                              onClick: () => {
                                b(!0);
                                const e = document.createElement("a");
                                ((e.href = f.download_url),
                                  (e.download = f.title),
                                  e.click());
                              },
                              children: "直接下载",
                            }),
                          }),
                      (0, p.jsxs)("div", {
                        className: "grid grid-cols-2 gap-2 mb-10",
                        children: [
                          (0, p.jsx)("div", {
                            className:
                              "max-h-[120px] overflow-hidden object-top",
                            children:
                              !j && (0, p.jsx)(c.A, { adKey: "download2" }),
                          }),
                          (0, p.jsx)("div", {
                            className:
                              "max-h-[120px] overflow-hidden object-top",
                            children:
                              !j && (0, p.jsx)(c.A, { adKey: "download3" }),
                          }),
                        ],
                      }),
                      (0, p.jsx)("div", {
                        className: "text-[red] pt-6 pb-72",
                        children:
                          Array.isArray(x) &&
                          x.map((e) => (0, p.jsx)("p", { children: e }, e)),
                      }),
                    ],
                  }),
                  (!z || (!y && null !== y)) &&
                    (0, p.jsx)(d.Fe, {
                      albumDownloadDetail: f,
                      isLogined: z,
                      setIsLogined: N,
                      isCorrect: y,
                      setIsCorrect: b,
                      setUserAnswer: g,
                    }),
                ],
              }),
        });
      };
    },
    7332: (e, o, l) => {
      l.d(o, { A: () => n });
      var t = l(9662),
        i = l(579);
      const n = (0, t.A)(
        (0, i.jsx)("path", {
          d: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z",
        }),
        "ArrowBack",
      );
    },
    3438: (e, o, l) => {
      l.d(o, { A: () => n });
      var t = l(9662),
        i = l(579);
      const n = (0, t.A)(
        (0, i.jsx)("path", {
          d: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        }),
        "Close",
      );
    },
    8911: (e, o, l) => {
      l.d(o, { A: () => n });
      var t = l(9662),
        i = l(579);
      const n = (0, t.A)(
        (0, i.jsx)("path", {
          d: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8",
        }),
        "Replay",
      );
    },
    9662: (e, o, l) => {
      l.d(o, { A: () => S });
      var t = l(9379),
        i = l(5043),
        n = l(45),
        r = l(8387),
        s = l(8610),
        a = l(6803),
        c = l(2108),
        d = l(6262),
        u = l(6431),
        v = l(2532),
        m = l(2372);
      function p(e) {
        return (0, m.Ay)("MuiSvgIcon", e);
      }
      (0, v.A)("MuiSvgIcon", [
        "root",
        "colorPrimary",
        "colorSecondary",
        "colorAction",
        "colorError",
        "colorDisabled",
        "fontSizeInherit",
        "fontSizeSmall",
        "fontSizeMedium",
        "fontSizeLarge",
      ]);
      var h = l(579);
      const x = [
          "children",
          "className",
          "color",
          "component",
          "fontSize",
          "htmlColor",
          "inheritViewBox",
          "titleAccess",
          "viewBox",
        ],
        f = (0, c.Ay)("svg", {
          name: "MuiSvgIcon",
          slot: "Root",
          overridesResolver: (e, o) => {
            const { ownerState: l } = e;
            return [
              o.root,
              "inherit" !== l.color && o["color".concat((0, a.A)(l.color))],
              o["fontSize".concat((0, a.A)(l.fontSize))],
            ];
          },
        })(
          (0, d.A)((e) => {
            var o, l, t, i, n, r, s, a, c, d, u, v, m, p, h;
            let { theme: x } = e;
            return {
              userSelect: "none",
              width: "1em",
              height: "1em",
              display: "inline-block",
              flexShrink: 0,
              transition:
                null === (o = x.transitions) ||
                void 0 === o ||
                null === (l = o.create) ||
                void 0 === l
                  ? void 0
                  : l.call(o, "fill", {
                      duration:
                        null ===
                          (t = (null !== (i = x.vars) && void 0 !== i ? i : x)
                            .transitions) ||
                        void 0 === t ||
                        null === (t = t.duration) ||
                        void 0 === t
                          ? void 0
                          : t.shorter,
                    }),
              variants: [
                {
                  props: (e) => !e.hasSvgAsChild,
                  style: { fill: "currentColor" },
                },
                {
                  props: { fontSize: "inherit" },
                  style: { fontSize: "inherit" },
                },
                {
                  props: { fontSize: "small" },
                  style: {
                    fontSize:
                      (null === (n = x.typography) ||
                      void 0 === n ||
                      null === (r = n.pxToRem) ||
                      void 0 === r
                        ? void 0
                        : r.call(n, 20)) || "1.25rem",
                  },
                },
                {
                  props: { fontSize: "medium" },
                  style: {
                    fontSize:
                      (null === (s = x.typography) ||
                      void 0 === s ||
                      null === (a = s.pxToRem) ||
                      void 0 === a
                        ? void 0
                        : a.call(s, 24)) || "1.5rem",
                  },
                },
                {
                  props: { fontSize: "large" },
                  style: {
                    fontSize:
                      (null === (c = x.typography) ||
                      void 0 === c ||
                      null === (d = c.pxToRem) ||
                      void 0 === d
                        ? void 0
                        : d.call(c, 35)) || "2.1875rem",
                  },
                },
                ...Object.entries(
                  (null !== (u = x.vars) && void 0 !== u ? u : x).palette,
                )
                  .filter((e) => {
                    let [, o] = e;
                    return o && o.main;
                  })
                  .map((e) => {
                    var o, l;
                    let [t] = e;
                    return {
                      props: { color: t },
                      style: {
                        color:
                          null ===
                            (o = (null !== (l = x.vars) && void 0 !== l ? l : x)
                              .palette) ||
                          void 0 === o ||
                          null === (o = o[t]) ||
                          void 0 === o
                            ? void 0
                            : o.main,
                      },
                    };
                  }),
                {
                  props: { color: "action" },
                  style: {
                    color:
                      null ===
                        (v = (null !== (m = x.vars) && void 0 !== m ? m : x)
                          .palette) ||
                      void 0 === v ||
                      null === (v = v.action) ||
                      void 0 === v
                        ? void 0
                        : v.active,
                  },
                },
                {
                  props: { color: "disabled" },
                  style: {
                    color:
                      null ===
                        (p = (null !== (h = x.vars) && void 0 !== h ? h : x)
                          .palette) ||
                      void 0 === p ||
                      null === (p = p.action) ||
                      void 0 === p
                        ? void 0
                        : p.disabled,
                  },
                },
                { props: { color: "inherit" }, style: { color: void 0 } },
              ],
            };
          }),
        ),
        j = i.forwardRef(function (e, o) {
          const l = (0, u.b)({ props: e, name: "MuiSvgIcon" }),
            {
              children: c,
              className: d,
              color: v = "inherit",
              component: m = "svg",
              fontSize: j = "medium",
              htmlColor: A,
              inheritViewBox: S = !1,
              titleAccess: w,
              viewBox: g = "0 0 24 24",
            } = l,
            y = (0, n.A)(l, x),
            b = i.isValidElement(c) && "svg" === c.type,
            z = (0, t.A)(
              (0, t.A)({}, l),
              {},
              {
                color: v,
                component: m,
                fontSize: j,
                instanceFontSize: e.fontSize,
                inheritViewBox: S,
                viewBox: g,
                hasSvgAsChild: b,
              },
            ),
            N = {};
          S || (N.viewBox = g);
          const k = ((e) => {
            const { color: o, fontSize: l, classes: t } = e,
              i = {
                root: [
                  "root",
                  "inherit" !== o && "color".concat((0, a.A)(o)),
                  "fontSize".concat((0, a.A)(l)),
                ],
              };
            return (0, s.A)(i, p, t);
          })(z);
          return (0, h.jsxs)(
            f,
            (0, t.A)(
              (0, t.A)(
                (0, t.A)(
                  (0, t.A)(
                    {
                      as: m,
                      className: (0, r.A)(k.root, d),
                      focusable: "false",
                      color: A,
                      "aria-hidden": !w || void 0,
                      role: w ? "img" : void 0,
                      ref: o,
                    },
                    N,
                  ),
                  y,
                ),
                b && c.props,
              ),
              {},
              {
                ownerState: z,
                children: [
                  b ? c.props.children : c,
                  w ? (0, h.jsx)("title", { children: w }) : null,
                ],
              },
            ),
          );
        });
      j.muiName = "SvgIcon";
      const A = j;
      function S(e, o) {
        function l(l, i) {
          return (0, h.jsx)(
            A,
            (0, t.A)(
              (0, t.A)({ "data-testid": "".concat(o, "Icon"), ref: i }, l),
              {},
              { children: e },
            ),
          );
        }
        return ((l.muiName = A.muiName), i.memo(i.forwardRef(l)));
      }
    },
  },
]);
//# sourceMappingURL=6811.0de21cab.chunk.js.map
