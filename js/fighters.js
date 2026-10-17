// Fighter roster: names, colours and the text shown in menus.
// Numbers that drive the fight live in sim.js (P); keep the text here in step with them.
export const FIGHTERS = {
  yosai: {
    en: "YOSAISOY", th: "ໂຍສາຍຊອຍ", role: "นักฆ่ามีด", special: true,
    body: "#3a1410", edge: "#1a0806", ink: "#ff5a36",
    mass: 1.05, cd: 3.9, skill: "เกาะแทง", dmg: "8 x 3",
    ult: "ไฟอันติ", ultDmg: "12 x 5 + พลุ 12",
    desc: "พุ่งเข้าไปเกาะศัตรูแล้วแทงมีดรัว 3 ครั้งก่อนปล่อย แทงโดนหรือโดนตีจะชาร์จไฟอันติ",
    ultDesc: "เปิดพลังเปลวไฟ กางปีกยมทูต พุ่งเข้าไปแทง 5 ครั้งแล้วระเบิดเป็นพลุไฟ",
    face: { idle: "img/fighters/yosai-idle.jpg", hurt: "img/fighters/yosai-hurt.jpg", ult: "img/fighters/yosai-ult.jpg" },
    voice: { intro: "sound/yosai-intro.mp3", hurt: "sound/yosai-hurt.mp3", ult: "sound/yosai-ult.mp3" }
  },
  archer: {
    en: "ARCHER", th: "ธนู", role: "ยิงไกล",
    body: "#3fc6ff", edge: "#0a5d8a", ink: "#5fd0ff",
    mass: 1.0, cd: 1.5, skill: "ยิงธนู", dmg: "7",
    desc: "ยิงลูกธนูพุ่งตรงใส่ศัตรูถี่ๆ โดนแล้วศัตรูกระเด็นนิดหน่อย"
  },
  bomb: {
    en: "BOMBER", th: "ระเบิด", role: "ระเบิดวงกว้าง",
    body: "#4b5672", edge: "#141a28", ink: "#ff9a3c",
    mass: 1.25, cd: 3.0, skill: "โยนระเบิด", dmg: "16",
    desc: "โยนระเบิดโค้งตามแรงโน้มถ่วง ระเบิดวงกว้าง ดีดศัตรูกระเด็นไกล"
  },
  blade: {
    en: "BLADE", th: "ใบมีด", role: "ประชิด",
    body: "#ff5470", edge: "#8c1a33", ink: "#ff7a90",
    mass: 1.1, cd: 4.2, skill: "ใบมีดหมุน", dmg: "6 / ครั้ง",
    desc: "ใบมีด 3 ใบหมุนรอบตัว 3 วินาที ฟันซ้ำได้ และปัดธนูหรือน้ำแข็งที่โดนใบมีดทิ้ง"
  },
  volt: {
    en: "VOLT", th: "สายฟ้า", role: "พุ่งชน",
    body: "#ffd43b", edge: "#8a6400", ink: "#ffd43b",
    mass: 0.9, cd: 2.6, skill: "พุ่งสายฟ้า", dmg: "12",
    desc: "พุ่งชนศัตรูด้วยความเร็วสูง ชนโดนแล้วดีดศัตรูกระเด็นแรง"
  },
  shield: {
    en: "GUARD", th: "โล่", role: "ป้องกัน",
    body: "#36d399", edge: "#0b6b48", ink: "#5ef0b4",
    mass: 1.3, cd: 4.5, skill: "โล่สะท้อน", dmg: "9",
    desc: "กางโล่ 1.8 วินาที กันดาเมจได้ทุกอย่าง สะท้อนธนูกับระเบิดกลับ ชนศัตรูตอนกางโล่จะกระแทกแรง"
  },
  vampire: {
    en: "VAMPIRE", th: "แวมไพร์", role: "ดูดเลือด",
    body: "#8e44ec", edge: "#3a1270", ink: "#c48bff",
    mass: 1.0, cd: 4.0, skill: "ดูดเลือด", dmg: "10 + ฮีล 5",
    desc: "ยิงลำแสงดูดเลือดใส่ศัตรูที่อยู่ใกล้ ดูด HP มาเติมให้ตัวเอง"
  },
  frost: {
    en: "FROST", th: "น้ำแข็ง", role: "ควบคุม",
    body: "#d4f1ff", edge: "#2f6ea5", ink: "#a6e3ff",
    mass: 1.0, cd: 2.9, skill: "เกล็ดน้ำแข็ง", dmg: "5 x 3",
    desc: "ปาเกล็ดน้ำแข็ง 3 อัน โดนแล้วศัตรูหนาว สกิลชาร์จช้าลงครึ่งหนึ่ง"
  },
  blaze: {
    en: "BLAZE", th: "ไฟ", role: "พื้นที่",
    body: "#ff7a1a", edge: "#8a3300", ink: "#ffa04d",
    mass: 1.0, cd: 5.5, skill: "ทางไฟ", dmg: "2 / ครั้ง",
    desc: "วิ่งทิ้งรอยไฟไว้ 3 วินาที ศัตรูเหยียบรอยไฟหรือโดนชนจะติดไฟ เสียเลือดต่อเนื่อง"
  },
  magnet: {
    en: "MAGNET", th: "แม่เหล็ก", role: "ดึงเข้าหา",
    body: "#e8384f", body2: "#3a6df0", edge: "#241433", ink: "#ff6b81",
    mass: 1.15, cd: 3.6, skill: "แม่เหล็กดูด", dmg: "13",
    desc: "ดูดศัตรูเข้าหาตัว ถ้าชนกันระหว่างดูดจะช็อตแรง"
  }
};

export const ORDER = ["yosai", "archer", "bomb", "blade", "volt", "shield", "vampire", "frost", "blaze", "magnet"];
