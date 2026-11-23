/**
 * CCTV 4K 专区电视端 QuickJS 爬虫
 * 适配电视端 FongMi / TVBox / CatVod (type: 3)
 *
 * 特性：
 * 1. 直连央视官方 4K 专区底层 API (CHAL1558416868484111)
 * 2. 覆盖电视剧、纪录片、文化旅游、生活美食、科教等全部分类
 * 3. 自动解析剧集专辑，完整拉取全部集数（第1集~第N集）
 * 4. 直出 4000K 码率超清免嗅探无加密 Master M3U8 (parse: 0, 零转码、零服务器中转开销)
 */

const API_BASE = "https://api.cntv.cn";
const CDN_BASE = "https://hls.cntv.cdn20.com/asp/hls/4000/0303000a/3/default";

const DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://tv.cctv.com/4K/index.shtml"
};

function init(ext) {
    // 爬虫初始化
}

function home(filter) {
    try {
        const classes = [
            { type_id: "all", type_name: "全部精选" },
            { type_id: "电视剧", type_name: "经典好剧" },
            { type_id: "纪录片", type_name: "人文纪录" },
            { type_id: "生活", type_name: "华夏美食" },
            { type_id: "科教", type_name: "文化旅游" },
            { type_id: "综艺", type_name: "综艺大赏" },
            { type_id: "新闻", type_name: "专题新闻" }
        ];

        return JSON.stringify({
            class: classes,
            filters: {}
        });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

function homeVod() {
    try {
        // 首页推荐：拉取最新第 1 页
        return category("all", 1, false, {});
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function category(tid, pg, filter, extend) {
    try {
        const page = parseInt(pg) || 1;
        const pageSize = 20;
        const url = `${API_BASE}/NewVideo/getLastVideoList4K?serviceId=cctv4k&cid=CHAL1558416868484111&p=${page}&n=${pageSize}&t=json`;

        const res = req(url, { headers: DEFAULT_HEADERS });
        if (!res || !res.content) {
            return JSON.stringify({ list: [] });
        }

        const data = JSON.parse(res.content);
        const rawList = (data && data.data && data.data.list) || [];
        const total = (data && data.data && data.data.total) || 0;

        const list = [];
        for (let i = 0; i < rawList.length; i++) {
            const item = rawList[i];
            const fc = (item.fc || "").trim();

            // 如果分类不是 "all"，按分类筛选
            if (tid && tid !== "all" && fc !== tid) {
                // 特殊映射：若选文化旅游，匹配科教或文化
                if (tid === "科教" && (fc === "科教" || fc === "文化")) {
                    // 放行
                } else {
                    continue;
                }
            }

            const lastVideo = item.last_video || {};
            const title = (item.title || lastVideo.title || "").trim();
            const pic = item.image || item.image3 || lastVideo.image || "";
            const albumId = item.id || "";
            const guid = lastVideo.id || "";
            const vsetid = item.vsetid || "";

            // vod_id 格式：albumId@@vsetid@@guid@@title
            const vodId = `${albumId}@@${vsetid}@@${guid}@@${encodeURIComponent(title)}`;

            list.push({
                vod_id: vodId,
                vod_name: title,
                vod_pic: pic.startsWith("//") ? "https:" + pic : pic,
                vod_remarks: fc ? `4K超清·${fc}` : "4K超清",
                vod_year: ""
            });
        }

        return JSON.stringify({
            page: page,
            pagecount: Math.ceil(total / pageSize) || 10,
            limit: pageSize,
            total: total,
            list: list
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function detail(id) {
    try {
        // id 格式：albumId@@vsetid@@guid@@title
        const parts = id.split("@@");
        const albumId = parts[0] || "";
        const vsetid = parts[1] || "";
        const defaultGuid = parts[2] || "";
        const name = parts[3] ? decodeURIComponent(parts[3]) : "CCTV 4K超清";

        let epList = [];

        // 尝试拉取专辑所有分集
        if (albumId) {
            const listUrl = `${API_BASE}/NewVideo/getVideoListByAlbumIdNew?id=${albumId}&serviceId=cctv4k&p=1&n=100&sort=asc&mode=0&pub=1&t=json`;
            const res = req(listUrl, { headers: DEFAULT_HEADERS });
            if (res && res.content) {
                try {
                    const data = JSON.parse(res.content);
                    const rawEps = (data && data.data && data.data.list) || [];
                    for (let i = 0; i < rawEps.length; i++) {
                        const ep = rawEps[i];
                        const epTitle = (ep.title || `第${i + 1}集`).trim();
                        const epGuid = ep.guid || "";
                        if (epGuid) {
                            epList.push(`${epTitle}$${epGuid}`);
                        }
                    }
                } catch (e) {}
            }
        }

        // 如果未拉取到分集列表，使用默认单集
        if (epList.length === 0 && defaultGuid) {
            epList.push(`4K超清正片$${defaultGuid}`);
        }

        const vod = [{
            vod_id: id,
            vod_name: name,
            vod_pic: "",
            type_name: "CCTV 4K",
            vod_year: "2026",
            vod_area: "中国",
            vod_remarks: `全${epList.length}集`,
            vod_actor: "央视制作",
            vod_director: "中央广播电视总台",
            vod_content: "中央广播电视总台 CCTV 4K超清专区，提供 4000K 极清画质呈现。",
            vod_play_from: "央视超清",
            vod_play_url: epList.join("#")
        }];

        return JSON.stringify({ list: vod });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function play(flag, id, flags) {
    try {
        // id 即为央视分集的 GUID
        let playUrl = "";
        if (id.startsWith("http")) {
            playUrl = id;
        } else {
            // 直连 4000K 码率超清 m3u8
            playUrl = `${CDN_BASE}/${id}/4000.m3u8`;
        }

        return JSON.stringify({
            parse: 0,
            url: playUrl,
            header: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://tv.cctv.com/"
            }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "" });
    }
}

function search(wd, quick) {
    return JSON.stringify({ list: [] });
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
