import { FaGithub, FaQq } from "react-icons/fa";
import { FaBilibili } from "react-icons/fa6";

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

export const tools = [
    {
        title: "冥人唐",
        href: "/tools/famous",
        desc: "展示服内名人",
    },
];

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