import { FaGithub, FaQq } from "react-icons/fa";
import { FaBilibili } from "react-icons/fa6";
import { RiBloggerLine, RiHomeLine, RiInformationLine, RiToolsLine, RiUserLine } from "react-icons/ri";

const social = [
    {
        name: "Github",
        icon: FaGithub,
        link: "https://github.com/RadicalSMP",
    },
    {
        name: "QQ",
        icon: FaQq,
        link: "https://qm.qq.com/cgi-bin/qm/qr?k=amv2BMUrV1uHOm8slPEWvfGPw1Ra22u1&jump_from=webapi&authKey=xJnx38LtDuFq+y8idNBzolbc4xY+0nOJYdcKuZN7LeEpQPHvKa8uu172/yUgOLiU",
    },
    {
        name: "哔哩哔哩",
        icon: FaBilibili,
        link: "https://space.bilibili.com/3461567301552927"
    }

];

export const org = {
    name: "RadicalSMP",
    name_cn: "根号的离谱服务器",
    social: social,
    avatar: "/images/rsmp_logo_web.jpg",
};

export const navbar_routes = [
    { href: "/", label: "首页" , icon: RiHomeLine},
    { href: "/blogs", label: "博客", icon: RiBloggerLine},
    { href: "/about", label: "关于", icon: RiInformationLine},
    {
        href: "/tools",
        label: "工具",
        icon: RiToolsLine,
        children: [
            {
                href: "/tools/famous",
                label: "冥人唐",
                icon: RiUserLine,
            },
        ],
    },
]

export const famous = [
    {
        name: "物服",
        mcid: "bjytxsc",
        role: "服务器管理 / 服务器联合创始人",
        tags: ["管理", "运维"],
        desc: "你服三太阳之一",
    },
    {
        name: "白龙",
        mcid: "WhiteDragen",
        role: "服务器管理",
        tags: ["管理",],
        desc: "待填写...",
    },
]