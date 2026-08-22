import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  aiImportSchema,
  backupSchema,
  backupSchemaV1,
  backupSchemaV2,
  normalizeJsonInput,
} from "./schemas";
import {
  applyReview,
  db,
  dateKey,
  dateLabel,
  dayStart,
  id,
  isToday,
  type DailyCheckin,
  type Library,
  type LibraryGroup,
  type MemoryItem,
  type MemoryType,
  type ReviewLog,
  type ReviewRating,
} from "./db";

const typeLabel: Record<MemoryType, string> = {
  recall: "回忆",
  cloze: "填空",
  choice: "单选",
};
const typeGlyph: Record<MemoryType, string> = {
  recall: "▤",
  cloze: "T",
  choice: "☷",
};
const fmtDate = (n: number) => {
  const d = new Date(n);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};
const fmtTime = (n: number) =>
  new Date(n).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const shuffle = <T,>(a: T[]) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

function Icon({ children }: { children: string }) {
  return (
    <span className="icon" aria-hidden="true">
      {children}
    </span>
  );
}
function Back({ title }: { title: string }) {
  const nav = useNavigate();
  return (
    <div className="page-head">
      <button className="icon-button" onClick={() => nav(-1)} aria-label="返回">
        <Icon>‹</Icon>
      </button>
      <h1>{title}</h1>
      <span />
    </div>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={secondary ? "button secondary" : "button"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Empty({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">○</div>
      <h3>{title}</h3>
      {action}
    </div>
  );
}
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("$") ? (
          <code className="formula" key={i}>
            {p.replace(/^\$\$?|\$\$?$/g, "")}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
function ClozeText({
  content,
  revealed,
}: {
  content: string;
  revealed: boolean;
}) {
  const parts = content.split(/(\{\{[\s\S]+?\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("{{") ? (
          <span
            key={i}
            className={revealed ? "cloze-revealed" : "cloze-hidden"}
          >
            {revealed ? p.slice(2, -2) : "　　"}
          </span>
        ) : (
          <RichText key={i} text={p} />
        ),
      )}
    </>
  );
}
function Nav() {
  const nav = useNavigate(),
    loc = useLocation();
  const active = loc.pathname.startsWith("/libraries")
    ? "libraries"
    : loc.pathname.startsWith("/records")
      ? "records"
      : "home";
  return (
    <nav className="bottom-nav">
      <button
        className={active === "home" ? "active" : ""}
        onClick={() => nav("/")}
      >
        <Icon>⌂</Icon>
        <span>首页</span>
      </button>
      <button
        className={active === "libraries" ? "active" : ""}
        onClick={() => nav("/libraries")}
      >
        <Icon>□</Icon>
        <span>知识库</span>
      </button>
      <button
        className={active === "records" ? "active" : ""}
        onClick={() => nav("/records")}
      >
        <Icon>▤</Icon>
        <span>记录</span>
      </button>
    </nav>
  );
}
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-root">
      <main className="content">{children}</main>
      <Nav />
    </div>
  );
}

function Home({ libs, items }: { libs: Library[]; items: MemoryItem[] }) {
  const nav = useNavigate();
  const due = items.filter((x) => x.nextReviewAt <= Date.now()).length;
  const recentLibs = libs
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);
  const recent = items
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  return (
    <Layout>
      <div className="home-head">
        <div>
          <div className="date-display">{fmtDate(Date.now())}</div>
          <div className="subtitle">今天想背什么？</div>
        </div>
        <button
          className="icon-button"
          onClick={() => nav("/settings")}
          aria-label="设置"
        >
          <Icon>⚙</Icon>
        </button>
      </div>
      <Button onClick={() => nav("/study/setup")}>
        开始背诵 <span>→</span>
      </Button>
      <Button secondary onClick={() => nav("/add")}>
        ＋ 添加内容
      </Button>
      <section>
        <div className="section-head">
          <h2>最近知识库</h2>
          <button onClick={() => nav("/libraries")}>查看全部 ›</button>
        </div>
        {recentLibs.length ? (
          <div className="library-grid">
            {recentLibs.map((l) => (
              <LibraryCard
                key={l.id}
                lib={l}
                items={items.filter((i) => i.libraryId === l.id)}
                onClick={() => nav(`/libraries/${l.id}`)}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="还没有知识库"
            action={
              <Button onClick={() => nav("/libraries")}>新建知识库</Button>
            }
          />
        )}
      </section>
      <section>
        <div className="section-head">
          <h2>最近添加</h2>
          <button onClick={() => nav("/records")}>查看全部 ›</button>
        </div>
        {recent.length ? (
          <div className="recent-list">
            {recent.map((i) => (
              <RecentRow
                key={i.id}
                item={i}
                lib={libs.find((l) => l.id === i.libraryId)}
              />
            ))}
          </div>
        ) : (
          <Empty title="还没有添加内容" />
        )}
      </section>
      <div className="home-footnote">
        当前有 <b>{due}</b> 条内容待复习
      </div>
    </Layout>
  );
}
function LibraryCard({
  lib,
  items,
  onClick,
}: {
  lib: Library;
  items: MemoryItem[];
  onClick: () => void;
}) {
  return (
    <button className="library-card" onClick={onClick}>
      <div className="glyph-box">
        {items[0] ? typeGlyph[items[0].type] : "□"}
      </div>
      <div>
        <strong>{lib.name}</strong>
        <span>
          {items.length} 条 ·{" "}
          {items.filter((i) => i.nextReviewAt <= Date.now()).length} 条待复习
        </span>
      </div>
      <Icon>›</Icon>
    </button>
  );
}
function RecentRow({ item, lib }: { item: MemoryItem; lib?: Library }) {
  return (
    <div className="recent-row">
      <div className="glyph-box small">◷</div>
      <div>
        <strong>
          {isToday(item.createdAt)
            ? `今天 ${fmtTime(item.createdAt)}`
            : fmtDate(item.createdAt)}
        </strong>
        <span>
          {lib?.name || "未命名知识库"} · {typeLabel[item.type]}
        </span>
      </div>
      <Icon>›</Icon>
    </div>
  );
}

function Libraries({
  libs,
  items,
  onRefresh,
}: {
  libs: Library[];
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const create = async () => {
    const name = window.prompt("知识库名称");
    if (!name?.trim()) return;
    const now = Date.now();
    await db.libraries.add({
      id: id("lib"),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
    });
    onRefresh();
  };
  const remove = async (l: Library) => {
    if (!window.confirm(`删除“${l.name}”及其全部内容？`)) return;
    await db.transaction("rw", db.libraries, db.items, async () => {
      await db.items.where("libraryId").equals(l.id).delete();
      await db.libraries.delete(l.id);
    });
    onRefresh();
  };
  return (
    <Layout>
      <div className="page-top">
        <h1>知识库</h1>
        <button className="text-button" onClick={create}>
          ＋ 新建
        </button>
      </div>
      {libs.length ? (
        <div className="stack">
          {libs
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((l) => (
              <div className="library-list-row" key={l.id}>
                <button
                  className="row-main"
                  onClick={() => nav(`/libraries/${l.id}`)}
                >
                  <div className="glyph-box">▤</div>
                  <div>
                    <strong>{l.name}</strong>
                    <span>
                      {items.filter((i) => i.libraryId === l.id).length} 条 ·{" "}
                      {
                        items.filter(
                          (i) =>
                            i.libraryId === l.id &&
                            i.nextReviewAt <= Date.now(),
                        ).length
                      }{" "}
                      条待复习
                    </span>
                  </div>
                  <Icon>›</Icon>
                </button>
                <button className="delete-link" onClick={() => remove(l)}>
                  删除
                </button>
              </div>
            ))}
        </div>
      ) : (
        <Empty
          title="还没有知识库"
          action={<Button onClick={create}>＋ 新建知识库</Button>}
        />
      )}
      <Button onClick={create}>＋ 新建知识库</Button>
    </Layout>
  );
}

function LibraryDetail({
  lib,
  items,
  onRefresh,
}: {
  lib: Library;
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const [sort, setSort] = useState<"default" | "new">("default");
  const libraryItems = items.filter((i) => i.libraryId === lib.id);
  const list = libraryItems
    .slice()
    .sort((a, b) =>
      sort === "new" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    );
  const remove = async (item: MemoryItem) => {
    if (!window.confirm("删除这条内容？")) return;
    await db.items.delete(item.id);
    onRefresh();
  };
  return (
    <Layout>
      <Back title={lib.name} />
      <div className="stats">
        <span>▤ {libraryItems.length} 条</span>
        <span>
          ◷ {libraryItems.filter((i) => i.nextReviewAt <= Date.now()).length}{" "}
          条待复习
        </span>
      </div>
      <Button onClick={() => nav(`/study/setup?library=${lib.id}`)}>
        开始背诵
      </Button>
      <Button secondary onClick={() => nav(`/add/manual?library=${lib.id}`)}>
        ＋ 添加
      </Button>
      <div className="section-head detail-head">
        <h2>全部内容</h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "default" | "new")}
        >
          <option value="default">默认排序</option>
          <option value="new">最近添加</option>
        </select>
      </div>
      {list.length ? (
        <div className="item-list">
          {list.map((item, idx) => (
            <div className="item-row" key={item.id}>
              <span className="item-number">{idx + 1}</span>
              <div className="glyph-box small">{typeGlyph[item.type]}</div>
              <div className="item-preview">
                <small>{typeLabel[item.type]}</small>
                <strong>{item.question || item.content || ""}</strong>
              </div>
              <button
                className="edit-link"
                onClick={() => nav(`/add/manual?edit=${item.id}`)}
              >
                ✎
              </button>
              <button
                className="icon-button"
                onClick={() => remove(item)}
                aria-label="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="这个知识库还没有内容"
          action={
            <Button onClick={() => nav(`/add/manual?library=${lib.id}`)}>
              添加第一条
            </Button>
          }
        />
      )}
    </Layout>
  );
}

function AddPage() {
  const nav = useNavigate();
  return (
    <Layout>
      <Back title="添加内容" />
      <p className="lead">选择一种方式，开始添加背诵内容</p>
      <div className="choice-menu">
        <button onClick={() => nav("/add/manual")}>
          <div className="glyph-box">✎</div>
          <div>
            <strong>手动添加</strong>
            <span>自己输入一条背诵内容</span>
          </div>
          <Icon>›</Icon>
        </button>
        <button onClick={() => nav("/add/ai")}>
          <div className="glyph-box">✦</div>
          <div>
            <strong>AI 整理导入</strong>
            <span>复制提示词，去外部 AI 整理后再粘贴</span>
          </div>
          <Icon>›</Icon>
        </button>
      </div>
      <div className="info-note">ⓘ 支持正反背诵、遮挡背诵、选择题</div>
    </Layout>
  );
}

function LibraryPicker({
  libs,
  value,
  onChange,
}: {
  libs: Library[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>导入到知识库</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {libs.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function ImageInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v?: string) => void;
}) {
  const [error, setError] = useState("");
  return (
    <div>
      <label className="image-input">
        <span>▧　选择图片（可选）</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 2 * 1024 * 1024) {
              setError("图片不能超过 2MB");
              return;
            }
            const r = new FileReader();
            r.onload = () => onChange(String(r.result));
            r.readAsDataURL(f);
          }}
        />
      </label>
      {error && <div className="error-text">{error}</div>}
      {value && <img className="preview-image" src={value} alt="卡片图片" />}
    </div>
  );
}
function GroupLibraryPicker({
  groups,
  libs,
  value,
  onChange,
  onRefresh,
}: {
  groups: LibraryGroup[];
  libs: Library[];
  value: string;
  onChange: (value: string) => void;
  onRefresh?: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [error, setError] = useState("");
  const groupPath = (group: LibraryGroup) => {
    const parent = group.parentId ? groups.find((candidate) => candidate.id === group.parentId) : undefined;
    return parent ? `${parent.name} / ${group.name}` : group.name;
  };
  const create = async () => {
    const name = newName.trim();
    if (!name) { setError("请输入知识库名称"); return; }
    const now = Date.now();
    const library: Library = { id: id("lib"), groupId: newGroupId || undefined, name, createdAt: now, updatedAt: now };
    await db.libraries.add(library);
    onChange(library.id);
    setNewName(""); setNewGroupId(""); setError(""); setShowCreate(false);
    onRefresh?.();
  };
  return (<>
    <label className="field"><span>知识库（可按分类和子分类查找）</span><div className="picker-with-action">
      <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">请选择知识库</option>{libs.map((library) => { const group = groups.find((candidate) => candidate.id === library.groupId); return <option key={library.id} value={library.id}>{group ? `${groupPath(group)} / ` : "未分类 / "}{library.name}</option>; })}</select>
      <button type="button" className="text-button" onClick={() => { setError(""); setShowCreate(true); }}>＋ 新建知识库</button>
    </div></label>
    {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><div className="modal compact-modal" onClick={(event) => event.stopPropagation()}>
      <div className="section-head modal-head"><h2>新建知识库</h2><button className="icon-button" onClick={() => setShowCreate(false)}>×</button></div>
      <label className="field"><span>知识库名称</span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} placeholder="例如：考研英语词汇" /></label>
      <label className="field"><span>所属分类</span><select value={newGroupId} onChange={(event) => setNewGroupId(event.target.value)}><option value="">未分类</option>{groups.map((group) => <option key={group.id} value={group.id}>{groupPath(group)}</option>)}</select></label>
      {error && <div className="error-box">{error}</div>}<div className="modal-actions"><Button secondary onClick={() => setShowCreate(false)}>取消</Button><Button onClick={() => void create()}>创建知识库</Button></div>
    </div></div>}
  </>);
}
function ManualPage({
  libs,
  items,
  groups = [],
  onRefresh,
}: {
  libs: Library[];
  items: MemoryItem[];
  groups?: LibraryGroup[];
  onRefresh: () => void;
}) {
  const nav = useNavigate(),
    loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const editId = params.get("edit");
  const editing = items.find((i) => i.id === editId);
  const [libraryId, setLibraryId] = useState(
    params.get("library") || editing?.libraryId || libs[0]?.id || "",
  );
  const [type, setType] = useState<MemoryType>(editing?.type || "recall");
  const [question, setQuestion] = useState(editing?.question || "");
  const [answer, setAnswer] = useState(editing?.answer || "");
  const [content, setContent] = useState(editing?.content || "");
  const [options, setOptions] = useState(editing?.options || ["", ""]);
  const [correctIndex, setCorrectIndex] = useState(editing?.correctIndex || 0);
  const [image, setImage] = useState(editing?.imageDataUrl);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    if (!libraryId) {
      setError("请先创建知识库");
      return;
    }
    if (type === "recall" && (!question.trim() || !answer.trim())) {
      setError("请填写问题和答案");
      return;
    }
    if (
      type === "cloze" &&
      (!content.trim() || !/{{[\s\S]+?}}/.test(content))
    ) {
      setError("遮挡背诵必须包含 {{答案}}");
      return;
    }
    if (
      type === "choice" &&
      (!question.trim() || options.filter((x) => x.trim()).length < 2)
    ) {
      setError("选择题至少需要 2 个选项");
      return;
    }
    const now = Date.now();
    const data: any = {
      type,
      libraryId,
      question: undefined,
      answer: undefined,
      content: undefined,
      options: undefined,
      correctIndex: undefined,
      imageDataUrl: image || undefined,
    };
    if (type === "recall") {
      data.question = question.trim();
      data.answer = answer.trim();
    }
    if (type === "cloze") data.content = content.trim();
    if (type === "choice") {
      data.question = question.trim();
      data.options = options.map((x) => x.trim()).filter(Boolean);
      data.correctIndex = correctIndex;
    }
    if (editing) {
      await db.items.update(editing.id, { ...data, updatedAt: now });
    } else
      await db.items.add({
        id: id("item"),
        batchId: id("batch"),
        ...data,
        createdAt: now,
        updatedAt: now,
        reviewLevel: 0,
        nextReviewAt: now,
        retentionFactor: 0.6,
      });
    await db.libraries.update(libraryId, { updatedAt: now });
    onRefresh();
    nav(`/libraries/${libraryId}`);
  };
  return (
    <Layout>
      <Back title={editing ? "编辑内容" : "手动添加"} />
      <GroupLibraryPicker groups={groups} libs={libs} value={libraryId} onChange={setLibraryId} onRefresh={onRefresh} />
      <div className="segmented">
        {(["recall", "cloze", "choice"] as MemoryType[]).map((t) => (
          <button
            key={t}
            className={type === t ? "active" : ""}
            onClick={() => setType(t)}
          >
            {typeLabel[t]}
          </button>
        ))}
      </div>
      <div className="form-card">
        {type === "recall" && (
          <>
            <label className="field">
              <span>问题</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：abandon"
              />
            </label>
            <label className="field">
              <span>答案</span>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="例如：放弃；抛弃"
              />
            </label>
          </>
        )}
        {type === "cloze" && (
          <>
            <label className="field">
              <span>内容</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="需要隐藏的答案请写成 {{答案}}"
              />
            </label>
            <p className="hint">
              需要隐藏的答案请写成 <code>{"{{答案}}"}</code>，多个遮挡也可以。
            </p>
          </>
        )}
        {type === "choice" && (
          <>
            <label className="field">
              <span>题目</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入题干"
              />
            </label>
            <div className="option-fields">
              {options.map((o, i) => (
                <div className="option-field" key={i}>
                  <input
                    value={o}
                    onChange={(e) =>
                      setOptions(
                        options.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                  />
                  <label>
                    <input
                      type="radio"
                      checked={correctIndex === i}
                      onChange={() => setCorrectIndex(i)}
                    />{" "}
                    正确
                  </label>
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                className="text-button"
                onClick={() => setOptions([...options, ""])}
              >
                ＋ 添加选项
              </button>
            )}
          </>
        )}
        <ImageInput value={image} onChange={setImage} />
      </div>
      {error && <div className="error-text">{error}</div>}
      <Button onClick={save}>保存</Button>
    </Layout>
  );
}

const PROMPT = `你是一个“学习资料转背诵卡片”的整理工具。
我接下来会提供一段需要背诵的学习资料。请只根据原资料，把它整理成适合快速复习的卡片，并严格遵守下面的规则。

【总规则】
1. 只允许使用三种卡片类型：recall、cloze、choice。
2. 核心事实、年份、人物、概念、定义、公式和原文关键表达不能遗漏，也不能凭空补充原资料没有的事实。
3. 一条卡片只考一个清晰的知识点；不要把过多无关内容塞进同一条卡片。
4. 最多输出 1000 条卡片。
5. 最终只能输出一个可以直接 JSON.parse 的 JSON 对象。不要输出 Markdown 代码块，不要输出解释、标题、注释、总结或任何 JSON 以外的文字。

【固定顶层格式】
{
  "version": 1,
  "items": []
}

【类型一：recall 正反背诵】
适合英语单词、英语短语、概念问答、定义问答、简短知识点。
字段必须是：
{
  "type": "recall",
  "question": "正面显示的问题、单词或短语",
  "answer": "背面显示的答案"
}
question 和 answer 都必须是非空字符串。
示例：
{
  "type": "recall",
  "question": "abandon",
  "answer": "放弃；抛弃"
}

【类型二：cloze 遮挡背诵】
适合政治知识点、年份、人物、固定表述、原句、数学公式和需要在上下文中回忆的关键内容。
字段必须是：
{
  "type": "cloze",
  "content": "完整上下文，把需要回忆的部分写成 {{答案}}"
}
content 必须至少包含一组 {{答案}}，可以包含多组遮挡。
只遮挡真正值得记忆的关键词、年份、人物、概念、固定短语或公式；不要把“的”“是”“了”“和”等无意义虚词单独遮挡，也不要把整句话全部遮挡。
遮挡前后要保留足够上下文，使用户看到题面后可以回忆答案。
示例：
{
  "type": "cloze",
  "content": "中华人民共和国成立于{{1949年}}。"
}
多处遮挡示例：
{
  "type": "cloze",
  "content": "新发展理念包括{{创新}}、{{协调}}、{{绿色}}、{{开放}}、{{共享}}。"
}

【类型三：choice 选择题】
只有原资料天然适合选择题，或原资料本身就是选择题时才使用，不要为了凑数量过度生成选择题。
字段必须是：
{
  "type": "choice",
  "question": "题干",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "correctIndex": 0
}
options 必须有 2 到 6 个非空选项。correctIndex 从 0 开始计数：A 是 0，B 是 1，C 是 2，D 是 3。正确答案必须确实来自原资料。
示例：
{
  "type": "choice",
  "question": "中华人民共和国成立于哪一年？",
  "options": ["1945年", "1949年", "1950年", "1952年"],
  "correctIndex": 1
}

【输出前自检】
- 顶层必须是 version=1 且包含 items 数组。
- 每条 item 必须且只能有 type 对应的必要字段。
- recall 必须有 question 和 answer。
- cloze 必须包含至少一组合法的 {{答案}}，不能写成空的 {{}}。
- choice 的 correctIndex 必须是从 0 开始的整数，并且小于 options 长度。
- 所有字符串使用合法 JSON 双引号，不能带尾逗号。

下面是我的学习资料：
`;
type PromptCardType = Extract<MemoryType, "recall" | "cloze" | "choice">;
const promptTypeMeta: Record<PromptCardType, { label: string; description: string; schema: string }> = {
  recall: {
    label: "正反回忆",
    description: "适合单词、短语、概念、定义和简短问答。问题放 question，答案放 answer。",
    schema: '{"type":"recall","question":"abandon","answer":"放弃；抛弃"}',
  },
  cloze: {
    label: "遮挡填空",
    description: "适合年份、人物、原句、公式和上下文中的关键事实。必须使用 {{答案}} 标记遮挡内容，保留足够上下文。",
    schema: '{"type":"cloze","content":"中华人民共和国成立于{{1949年}}。"}',
  },
  choice: {
    label: "选择题",
    description: "仅在原资料明确适合选择题时使用，不要为了凑数量强行改写。options 必须有 2-6 个选项，correctIndex 从 0 开始。",
    schema: '{"type":"choice","question":"中华人民共和国成立于哪一年？","options":["1945年","1949年","1950年"],"correctIndex":1}',
  },
};
const buildAiPrompt = (types: PromptCardType[]) => {
  const chosen = types.length ? types : (["recall"] as PromptCardType[]);
  const typeRules = chosen.map((type, index) => {
    const meta = promptTypeMeta[type];
    return `【卡片类型 ${index + 1}：${meta.label}（${type}）】\n${meta.description}\n字段示例：${meta.schema}`;
  }).join("\n\n");
  const allowed = chosen.join("、");
  return `你是“学习资料转背诵卡片”的整理工具。请只根据我最后提供的原始资料生成卡片。\n\n【本次允许的卡片类型】\n只允许使用：${allowed}。不要生成未被允许的类型。\n\n【通用规则】\n1. 不遗漏原资料中的核心事实、年份、人物、概念、定义、公式和关键表达，不凭空补充。\n2. 一条卡片只考一个清晰知识点，答案要能独立核对。\n3. 根据原资料自然拆分，不要为了凑数量重复改写。\n4. 最多输出 1000 条；没有足够内容时少生成，不要编造。\n\n${typeRules}\n\n【固定输出格式】\n只输出一个可直接 JSON.parse 的 JSON 对象，不要 Markdown 代码块、标题、解释或其他文字：\n{"version":1,"items":[]}\n\n【输出前自检】\n- 顶层必须是 version=1 且包含 items 数组。\n- 每条 item 只能使用已允许的 type。\n- recall 必须有非空 question 和 answer。\n- cloze 的 content 至少包含一组非空 {{答案}}。\n- choice 的 correctIndex 必须是 0 到 options.length-1 的整数，且答案确实来自原资料。\n- 所有字符串使用合法 JSON 双引号，不能有尾逗号。\n\n【原始学习资料】\n`;
};
function AiPage({
  libs,
  groups = [],
  onRefresh,
}: {
  libs: Library[];
  groups?: LibraryGroup[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const [libraryId, setLibraryId] = useState(libs[0]?.id || "");
  const [selectedTypes, setSelectedTypes] = useState<PromptCardType[]>([
    "recall",
    "cloze",
    "choice",
  ]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<any>();
  const prompt = useMemo(() => buildAiPrompt(selectedTypes), [selectedTypes]);
  const togglePromptType = (type: PromptCardType) => {
    setSelectedTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type);
      }
      return [...current, type];
    });
    setError("");
  };
  const validate = () => {
    setError("");
    setParsed(undefined);
    try {
      const obj = aiImportSchema.parse(JSON.parse(normalizeJsonInput(text)));
      setParsed(obj);
    } catch (e: any) {
      setError(e?.issues?.[0]?.message || "JSON 格式无法解析，请检查后重试");
    }
  };
  const importNow = async () => {
    if (!parsed || !libraryId) return;
    const now = Date.now(),
      batchId = id("batch");
    const rows = parsed.items.map((x: any) => ({
      id: id("item"),
      libraryId,
      batchId,
      ...x,
      createdAt: now,
      updatedAt: now,
      reviewLevel: 0,
      nextReviewAt: now,
      retentionFactor: 0.6,
    }));
    await db.items.bulkAdd(rows);
    await db.libraries.update(libraryId, { updatedAt: now });
    onRefresh();
    nav(`/libraries/${libraryId}`);
  };
  return (
    <Layout>
      <Back title="AI 整理导入" />
      <div className="steps">
        <span className="active">1 提示词</span>
        <span>2 生成 JSON</span>
        <span>3 粘贴校验</span>
        <span>4 导入</span>
      </div>
      <div className="prompt-type-picker">
        <div className="section-head prompt-type-head">
          <h2>选择卡片形式</h2>
          <button
            className="text-button"
            onClick={() => setSelectedTypes(["recall", "cloze", "choice"])}
          >
            全选
          </button>
        </div>
        <p className="prompt-type-hint">只会把已选形式写入提示词，单选时更简洁。</p>
        <div className="prompt-type-grid">
          {(Object.keys(promptTypeMeta) as PromptCardType[]).map((type) => (
            <label className={`prompt-type-card ${selectedTypes.includes(type) ? "active" : ""}`} key={type}>
              <input
                type="checkbox"
                checked={selectedTypes.includes(type)}
                onChange={() => togglePromptType(type)}
              />
              <span className="prompt-type-check">{selectedTypes.includes(type) ? "✓" : ""}</span>
              <span>
                <strong>{promptTypeMeta[type].label}</strong>
                <small>{type}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="prompt-box">
        <pre
          style={{
            font: "13px/1.7 ui-monospace,Consolas,monospace",
            whiteSpace: "pre-wrap",
            margin: "0 0 12px",
            maxHeight: 320,
            overflow: "auto",
            color: "#383633",
          }}
        >
          {prompt}
        </pre>
        <button
          className="text-button"
          onClick={() => navigator.clipboard?.writeText(prompt)}
        >
          复制完整提示词
        </button>
      </div>
      <GroupLibraryPicker groups={groups} libs={libs} value={libraryId} onChange={setLibraryId} onRefresh={onRefresh} />
      <label className="field">
        <span>粘贴 AI 输出的 JSON</span>
        <textarea
          className="json-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'{"version":1,"items":[...]}'}
        />
      </label>
      <Button secondary onClick={validate}>
        检查格式
      </Button>
      {error && <div className="error-box">{error}</div>}
      {parsed && (
        <div className="success-box">
          <b>格式正确</b>
          <span>
            共 {parsed.items.length} 条 · 正反{" "}
            {parsed.items.filter((x: any) => x.type === "recall").length} · 遮挡{" "}
            {parsed.items.filter((x: any) => x.type === "cloze").length} · 选择{" "}
            {parsed.items.filter((x: any) => x.type === "choice").length}
          </span>
        </div>
      )}
      <Button disabled={!parsed} onClick={importNow}>
        确认导入
      </Button>
    </Layout>
  );
}

function Setup({ libs, items, groups = [] }: { libs: Library[]; items: MemoryItem[]; groups?: LibraryGroup[] }) {
  const nav = useNavigate(),
    loc = useLocation();
  const preset = new URLSearchParams(loc.search).get("library");
  const [selected, setSelected] = useState<string[]>(
    preset ? [preset] : libs.map((l) => l.id),
  );
  const [range, setRange] = useState("due");
  const [manual, setManual] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const toggleGroup = (_groupId: string) => undefined;
  const categoryPicker = null;
  const candidates = items.filter((i) => selected.includes(i.libraryId));
  const count =
    range === "due"
      ? candidates.filter((i) => i.nextReviewAt <= Date.now()).length
      : range === "today"
        ? candidates.filter((i) => isToday(i.createdAt)).length
        : range === "manual"
          ? manual.length
          : candidates.length;
  const start = () => {
    let ids =
      range === "due"
        ? candidates
            .filter((i) => i.nextReviewAt <= Date.now())
            .map((i) => i.id)
        : range === "today"
          ? candidates.filter((i) => isToday(i.createdAt)).map((i) => i.id)
          : range === "manual"
            ? manual
            : candidates.map((i) => i.id);
    if (!ids.length) return;
    nav("/study", {
      state: { itemIds: selected.length > 1 ? shuffle(ids) : ids },
    });
  };
  return (
    <Layout>
      <Back title="开始背诵" />
      <h2>选择知识库</h2>
      {groups.length > 0 && (
        <div className="category-pick-section">
          <div className="section-head compact-section-head">
            <h2>按分类选择</h2>
            <span className="muted">一键选择分类内知识库</span>
          </div>
          <div className="library-checks category-checks">
            {groups.map((group) => {
              const groupLibraryIds = libs
                .filter((library) => library.groupId === group.id)
                .map((library) => library.id);
              const checked = groupLibraryIds.length > 0 && groupLibraryIds.every((id) => selected.includes(id));
              return (
                <label key={group.id} className="check-row category-check-row">
                  <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} disabled={groupLibraryIds.length === 0} />
                  <span>{group.name}</span>
                  <small>{groupLibraryIds.length} 个知识库</small>
                </label>
              );
            })}
          </div>
        </div>
      )}
      {categoryPicker}
      <div className="library-checks legacy-library-checks">
        {libs.map((l) => (
          <label key={l.id} className="check-row">
            <input
              type="checkbox"
              checked={selected.includes(l.id)}
              onChange={() => toggle(l.id)}
            />
            <span>{l.name}</span>
            <small>{items.filter((i) => i.libraryId === l.id).length} 条</small>
          </label>
        ))}
      </div>
      <h2>选择范围</h2>
      <div className="range-grid">
        {[
          ["due", "应复习", "到期的内容"],
          ["all", "全部", "所有内容"],
          ["today", "今天添加", "今天创建的内容"],
          ["manual", "手动选择", "自己勾选条目"],
        ].map(([v, t, s]) => (
          <button
            key={v}
            className={range === v ? "range-card active" : "range-card"}
            onClick={() => {
              setRange(v);
              if (v === "manual") setShowManual(true);
            }}
          >
            <strong>{t}</strong>
            <span>{s}</span>
          </button>
        ))}
      </div>
      {range === "manual" && (
        <button className="text-button" onClick={() => setShowManual(true)}>
          选择 {manual.length} 条内容 ›
        </button>
      )}
      {showManual && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="section-head">
              <h2>手动选择</h2>
              <button
                className="icon-button"
                onClick={() => setShowManual(false)}
              >
                ×
              </button>
            </div>
            {candidates.map((i) => (
              <label className="check-row" key={i.id}>
                <input
                  type="checkbox"
                  checked={manual.includes(i.id)}
                  onChange={() =>
                    setManual((s) =>
                      s.includes(i.id)
                        ? s.filter((x) => x !== i.id)
                        : [...s, i.id],
                    )
                  }
                />
                <span>{i.question || i.content}</span>
              </label>
            ))}
            <Button onClick={() => setShowManual(false)}>完成</Button>
          </div>
        </div>
      )}
      <div className="session-count">
        本次将复习 <b>{count}</b> 条内容
      </div>
      <Button disabled={!selected.length || !count} onClick={start}>
        开始背诵
      </Button>
      {!count && <div className="muted-center">没有符合条件的内容</div>}
    </Layout>
  );
}

function Study({
  items,
  onRefresh,
}: {
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const nav = useNavigate(),
    loc = useLocation();
  const state = loc.state as { itemIds?: string[] } | null;
  const [ids] = useState(state?.itemIds || []);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [done, setDone] = useState(false);
  const current = items.find((i) => i.id === ids[index]);
  if (!ids.length || !current)
    return (
      <Layout>
        <Empty
          title="没有可复习内容"
          action={<Button onClick={() => nav("/study/setup")}>返回设置</Button>}
        />
      </Layout>
    );
  const choose = (n: number) => {
    setSelected(n);
    setRevealed(true);
  };
  const rate = async (r: ReviewRating) => {
    await db.items.put(applyReview(current, r));
    onRefresh();
    if (index + 1 >= ids.length) setDone(true);
    else {
      setIndex(index + 1);
      setSelected(undefined);
      setRevealed(false);
    }
  };
  if (done)
    return (
      <Layout>
        <div className="complete">
          <div className="complete-mark">✓</div>
          <h1>本次完成</h1>
          <p>{ids.length} 条内容已复习</p>
          <Button onClick={() => nav("/")}>返回首页</Button>
        </div>
      </Layout>
    );
  return (
    <Layout>
      <div className="study-top">
        <button className="icon-button" onClick={() => nav(-1)}>
          ‹
        </button>
        <span>
          {index + 1} / {ids.length}
        </span>
        <span />
      </div>
      <div className="study-library">
        {current.type === "choice" ? "选择题" : typeLabel[current.type]}
      </div>
      <div
        className="study-card"
        onClick={() => current.type !== "choice" && setRevealed(true)}
      >
        {current.imageDataUrl && (
          <img className="study-image" src={current.imageDataUrl} alt="" />
        )}
        <div className="study-prompt">
          {current.type === "cloze" ? (
            <ClozeText content={current.content || ""} revealed={revealed} />
          ) : (
            <RichText text={current.question || ""} />
          )}
        </div>
        {current.type === "recall" && revealed && (
          <div className="study-answer">
            <RichText text={current.answer || ""} />
          </div>
        )}
        {current.type === "choice" && (
          <div className="study-options">
            {(current.options || []).map((o, i) => (
              <button
                key={i}
                className={
                  selected !== undefined
                    ? i === current.correctIndex
                      ? "correct"
                      : i === selected
                        ? "wrong"
                        : ""
                    : ""
                }
                onClick={() => choose(i)}
              >
                {String.fromCharCode(65 + i)}. {o}
              </button>
            ))}
          </div>
        )}{" "}
        {!revealed && current.type !== "choice" && (
          <span className="tap-hint">点击卡片查看答案</span>
        )}
      </div>
      <div className="rating-row">
        {[
          ["again", "忘记"],
          ["hard", "模糊"],
          ["good", "认识"],
        ].map(([r, t]) => (
          <button
            key={r}
            disabled={!revealed}
            className={`rating ${r}`}
            onClick={() => rate(r as ReviewRating)}
          >
            {t}
          </button>
        ))}
      </div>
    </Layout>
  );
}

function Records({ items, libs }: { items: MemoryItem[]; libs: Library[] }) {
  const [selected, setSelected] = useState(dateKey(Date.now()));
  const byDate = useMemo(() => {
    const m: Record<string, MemoryItem[]> = {};
    items.forEach((i) => (m[dateKey(i.createdAt)] ??= []).push(i));
    return m;
  }, [items]);
  const days = Object.keys(byDate).sort().reverse().slice(0, 14);
  const rows = byDate[selected] || [];
  const groups = Object.values(
    rows.reduce(
      (acc, i) => {
        (acc[i.batchId] ??= []).push(i);
        return acc;
      },
      {} as Record<string, MemoryItem[]>,
    ),
  );
  return (
    <Layout>
      <div className="page-top">
        <h1>记录</h1>
        <span className="muted">本地数据</span>
      </div>
      <div className="calendar-strip">
        {days.length ? (
          days.map((d) => (
            <button
              key={d}
              className={selected === d ? "active" : ""}
              onClick={() => setSelected(d)}
            >
              <span>
                {new Date(d).getMonth() + 1}/{new Date(d).getDate()}
              </span>
              <i />
            </button>
          ))
        ) : (
          <span className="muted">还没有添加记录</span>
        )}
      </div>
      <h2>{selected.replace(/-/g, " / ")}</h2>
      {groups.length ? (
        <div className="stack">
          {groups.map((g) => (
            <div className="batch-row" key={g[0].batchId}>
              <div>
                <strong>
                  {libs.find((l) => l.id === g[0].libraryId)?.name || "知识库"}
                </strong>
                <span>
                  {fmtTime(g[0].createdAt)} · {g.length} 条
                </span>
              </div>
              <span>
                {g.filter((i) => i.nextReviewAt <= Date.now()).length} 条待复习
                ›
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="这一天没有添加内容" />
      )}
      <div className="record-note">
        遗忘进度：当前只显示每个知识库的总条数与待复习条数。
      </div>
    </Layout>
  );
}

function Settings({
  libs,
  items,
  onRefresh,
}: {
  libs: Library[];
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState("");
  const exportData = async () => {
    const payload = {
      schemaVersion: 2,
      exportedAt: Date.now(),
      libraryGroups: await db.libraryGroups.toArray(),
      libraries: libs,
      items,
      reviewLogs: await db.reviewLogs.toArray(),
      dailyCheckins: await db.dailyCheckins.toArray(),
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    a.download = `recall-lite-backup-${dateKey(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage("V2 备份已导出");
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      let data: any;
      if (raw.schemaVersion === 2) data = backupSchemaV2.parse(raw);
      else {
        const old = backupSchemaV1.parse(raw);
        data = {
          schemaVersion: 2,
          exportedAt: old.exportedAt,
          libraryGroups: [],
          libraries: old.libraries,
          items: old.items,
          reviewLogs: [],
          dailyCheckins: [],
        };
      }
      const libIds = new Set(data.libraries.map((l: any) => l.id));
      if (data.items.some((i: any) => !libIds.has(i.libraryId)))
        throw new Error("存在找不到所属知识库的条目");
      if (!window.confirm("导入会覆盖当前所有数据，确定继续？")) return;
      await db.transaction(
        "rw",
        db.libraryGroups,
        db.libraries,
        db.items,
        db.reviewLogs,
        db.dailyCheckins,
        async () => {
          await db.dailyCheckins.clear();
          await db.reviewLogs.clear();
          await db.items.clear();
          await db.libraries.clear();
          await db.libraryGroups.clear();
          await db.libraryGroups.bulkAdd(data.libraryGroups);
          await db.libraries.bulkAdd(data.libraries);
          await db.items.bulkAdd(data.items);
          await db.reviewLogs.bulkAdd(data.reviewLogs);
          await db.dailyCheckins.bulkAdd(data.dailyCheckins);
        },
      );
      onRefresh();
      setMessage("备份已恢复");
    } catch (e: any) {
      setMessage(e?.issues?.[0]?.message || e.message || "备份文件无效");
    }
  };
  const clear = async () => {
    if (!window.confirm("确定清空全部数据？此操作不可撤销。")) return;
    await db.transaction(
      "rw",
      db.libraryGroups,
      db.libraries,
      db.items,
      db.reviewLogs,
      db.dailyCheckins,
      async () => {
        await db.dailyCheckins.clear();
        await db.reviewLogs.clear();
        await db.items.clear();
        await db.libraries.clear();
        await db.libraryGroups.clear();
      },
    );
    onRefresh();
    setMessage("数据已清空");
  };
  return (
    <Layout>
      <Back title="设置" />
      <h2>数据</h2>
      <div className="settings-list">
        <button onClick={exportData}>
          <div className="glyph-box">↑</div>
          <div>
            <strong>导出 V2 备份</strong>
            <span>包含分类、复习记录和打卡</span>
          </div>
          <Icon>›</Icon>
        </button>
        <label>
          <div className="glyph-box">↓</div>
          <div>
            <strong>导入备份</strong>
            <span>兼容 V1，覆盖当前数据并恢复</span>
          </div>
          <Icon>›</Icon>
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => importData(e.target.files?.[0])}
          />
        </label>
      </div>
      <h2>关于</h2>
      <div className="settings-list">
        <div>
          <div className="glyph-box">ⓘ</div>
          <div>
            <strong>App 名称</strong>
          </div>
          <span>Recall Lite</span>
        </div>
        <div>
          <div className="glyph-box">⌁</div>
          <div>
            <strong>版本</strong>
          </div>
          <span>V2 Web</span>
        </div>
        <div>
          <div className="glyph-box">◉</div>
          <div>
            <strong>本地存储</strong>
          </div>
          <span>仅保存在本机</span>
        </div>
      </div>
      {message && <div className="success-box">{message}</div>}
      <button className="danger-button" onClick={clear}>
        清空全部数据
      </button>
    </Layout>
  );
}

const ratingText: Record<ReviewRating, string> = {
  again: "忘记",
  hard: "模糊",
  good: "认识",
};
const STUDY_RESUME_KEY = "recall-lite-study-resume-v1";
type StudyResumeSnapshot = {
  itemIds: string[];
  queue: string[];
  session: Record<string, SessionState>;
  completed: ReviewLog[];
  revealed: boolean;
  selected?: number;
  savedAt: number;
};
const readStudyResume = (): StudyResumeSnapshot | null => {
  try {
    const raw = localStorage.getItem(STUDY_RESUME_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StudyResumeSnapshot;
    return Array.isArray(value.itemIds) && Array.isArray(value.queue) ? value : null;
  } catch {
    return null;
  }
};
const clearStudyResume = () => localStorage.removeItem(STUDY_RESUME_KEY);
const severity: Record<ReviewRating, number> = { good: 0, hard: 1, again: 2 };
const retentionOf = (item: MemoryItem, now = Date.now()) => {
  const target = item.retentionFactor ?? 0.6;
  if (!item.lastReviewedAt) return item.nextReviewAt <= now ? target : 1;
  const interval = Math.max(item.nextReviewAt - item.lastReviewedAt, 86400000);
  const elapsed = Math.max(0, now - item.lastReviewedAt);
  return Math.max(
    0,
    Math.min(1, Math.exp((-(-Math.log(target)) * elapsed) / interval)),
  );
};
const aggregateLogs = (logs: ReviewLog[]) => ({
  reviewedCount: logs.length,
  goodCount: logs.filter((x) => x.result === "good").length,
  hardCount: logs.filter((x) => x.result === "hard").length,
  againCount: logs.filter((x) => x.result === "again").length,
  reinforcementCount: logs.reduce((n, x) => n + x.reinforcementCount, 0),
});
const lastDays = (count: number, end = Date.now()) =>
  Array.from({ length: count }, (_, i) =>
    dateKey(dayStart(end) - (count - 1 - i) * 86400000),
  );

function MiniBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-bars">
      {values.map((v, i) => (
        <div className="mini-bar-col" key={labels[i]}>
          <div className="mini-bar-track">
            <i style={{ height: `${Math.max(v ? 8 : 2, (v / max) * 100)}%` }} />
          </div>
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
}
function RetentionChart({ items }: { items: MemoryItem[] }) {
  const horizonDays = [0, 7, 30, 90, 180, 365, 730, 1460];
  const points = horizonDays.map((days) =>
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (items.length
            ? items.reduce(
                (s, x) => s + retentionOf(x, Date.now() + days * 86400000),
                0,
              ) / items.length
            : 0) * 100,
        ),
      ),
    ),
  );
  const poly = points.map((v, i) => `${i * 14.28},${100 - v}`).join(" ");
  return (
    <div className="retention-chart">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label="记忆保持趋势"
      >
        <path
          d={`M ${poly}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-x">
        <span>今天</span>
        <span>7天</span>
        <span>30天</span>
        <span>90天</span>
        <span>180天</span>
        <span>1年</span>
        <span>2年</span>
        <span>4年</span>
      </div>
    </div>
  );
}
function HomeV2({
  groups,
  libs,
  items,
  logs,
  checkins,
}: {
  groups: LibraryGroup[];
  libs: Library[];
  items: MemoryItem[];
  logs: ReviewLog[];
  checkins: DailyCheckin[];
}) {
  const nav = useNavigate();
  const todayLogs = logs.filter((x) => isToday(x.reviewedAt));
  const stats = aggregateLogs(todayLogs);
  const due = items.filter((x) => x.nextReviewAt <= Date.now()).length;
  const days = lastDays(7);
  const values = days.map(
    (d) => logs.filter((x) => dateKey(x.reviewedAt) === d).length,
  );
  const avg = items.length
    ? Math.round(
        (items.reduce((s, x) => s + retentionOf(x), 0) / items.length) * 100,
      )
    : 0;
  const checked = checkins.some((x) => x.dateKey === dateKey(Date.now()));
  const recentLibs = libs
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);
  return (
    <Layout>
      <div className="home-head">
        <div>
          <div className="date-display">
            {new Date().getMonth() + 1}月{new Date().getDate()}日
          </div>
          <div className="subtitle">今天想背什么？</div>
        </div>
        <button
          className="icon-button"
          onClick={() => nav("/settings")}
          aria-label="设置"
        >
          <Icon>⚙</Icon>
        </button>
      </div>
      <section className="summary-section">
        <div className="section-kicker">今日摘要</div>
        <div className="summary-grid">
          <div>
            <b>{stats.reviewedCount}</b>
            <span>已复习</span>
          </div>
          <div>
            <b>{due}</b>
            <span>待复习</span>
          </div>
          <div>
            <b>{checked ? "✓" : "○"}</b>
            <span>{checked ? "已打卡" : "未打卡"}</span>
          </div>
        </div>
      </section>
      <Button onClick={() => nav("/study/setup")}>
        开始背诵 <span>→</span>
      </Button>
      <Button secondary onClick={() => nav("/add")}>
        ＋ 添加内容
      </Button>
      <section className="chart-section">
        <div className="section-head">
          <h2>最近 7 天</h2>
          <span className="chart-total">
            {values.reduce((a, b) => a + b, 0)} 条
          </span>
        </div>
        <MiniBars
          values={values}
          labels={days.map((d) =>
            new Date(`${d}T00:00:00`).getDate().toString(),
          )}
        />
      </section>
      <section className="chart-section">
        <div className="section-head">
          <h2>记忆保持</h2>
          <span className="chart-total">当前预计保持度 {avg}%</span>
        </div>
        <p className="chart-caption">
          {items.filter((x) => x.nextReviewAt <= Date.now()).length} 条已到期
        </p>
        <RetentionChart items={items} />
      </section>
      <section>
        <div className="section-head">
          <h2>最近知识库</h2>
          <button onClick={() => nav("/libraries")}>查看全部 ›</button>
        </div>
        <div className="library-grid">
          {recentLibs.map((l) => (
            <LibraryCard
              key={l.id}
              lib={l}
              items={items.filter((i) => i.libraryId === l.id)}
              onClick={() => nav(`/libraries/${l.id}`)}
            />
          ))}
        </div>
      </section>
      <section>
        <div className="section-head">
          <h2>最近添加</h2>
          <button onClick={() => nav("/records")}>查看全部 ›</button>
        </div>
        <div className="recent-list">
          {items
            .slice()
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 3)
            .map((i) => (
              <RecentRow
                key={i.id}
                item={i}
                lib={libs.find((l) => l.id === i.libraryId)}
              />
            ))}
        </div>
      </section>
    </Layout>
  );
}

function LibrariesV2({
  groups,
  libs,
  items,
  onRefresh,
}: {
  groups: LibraryGroup[];
  libs: Library[];
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showLibraryForm, setShowLibraryForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [parentGroupId, setParentGroupId] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [formError, setFormError] = useState("");
  const [libraryToDelete, setLibraryToDelete] = useState<Library | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<LibraryGroup | null>(null);
  const [libraryToMove, setLibraryToMove] = useState<Library | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      setFormError("请输入分类名称");
      return;
    }
    const now = Date.now();
    await db.libraryGroups.add({
      id: id("group"),
      parentId: parentGroupId || undefined,
      name,
      createdAt: now,
      updatedAt: now,
    });
    setGroupName("");
    setParentGroupId("");
    setFormError("");
    setShowGroupForm(false);
    onRefresh();
  };
  const createLibrary = async () => {
    const name = libraryName.trim();
    if (!name) {
      setFormError("请输入知识库名称");
      return;
    }
    const now = Date.now();
    await db.libraries.add({
      id: id("lib"),
      groupId: selectedGroup || undefined,
      name,
      createdAt: now,
      updatedAt: now,
    });
    setLibraryName("");
    setFormError("");
    setShowLibraryForm(false);
    onRefresh();
  };
  const renameGroup = async (g: LibraryGroup) => {
    const name = window.prompt("重命名分类", g.name);
    if (name?.trim())
      await db.libraryGroups.update(g.id, {
        name: name.trim(),
        updatedAt: Date.now(),
      });
    onRefresh();
  };
  const deleteGroup = (g: LibraryGroup) => {
    setGroupToDelete(g);
  };
  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    const removedIds = new Set<string>([groupToDelete.id]);
    let changed = true;
    while (changed) {
      changed = false;
      groups.forEach((group) => {
        if (group.parentId && removedIds.has(group.parentId) && !removedIds.has(group.id)) {
          removedIds.add(group.id);
          changed = true;
        }
      });
    }
    await db.transaction("rw", db.libraryGroups, db.libraries, async () => {
      for (const groupId of removedIds) {
        await db.libraries.where("groupId").equals(groupId).modify({ groupId: undefined });
        await db.libraryGroups.delete(groupId);
      }
    });
    setGroupToDelete(null);
    onRefresh();
  };
  const deleteLibrary = async () => {
    if (!libraryToDelete) return;
    await db.transaction("rw", db.libraries, db.items, db.reviewLogs, async () => {
      await db.reviewLogs.where("libraryId").equals(libraryToDelete.id).delete();
      await db.items.where("libraryId").equals(libraryToDelete.id).delete();
      await db.libraries.delete(libraryToDelete.id);
    });
    setLibraryToDelete(null);
    onRefresh();
  };
  const moveLibrary = async () => {
    if (!libraryToMove) return;
    await db.libraries.update(libraryToMove.id, { groupId: moveTargetId || undefined, updatedAt: Date.now() });
    setLibraryToMove(null); setMoveTargetId(""); onRefresh();
  };
  const renderLib = (l: Library) => (
    <div className="tree-lib-row" key={l.id}>
      <button className="tree-lib" onClick={() => nav(`/libraries/${l.id}`)}>
        <span>▤</span>
        <span>
          <b>{l.name}</b>
          <small>
            {items.filter((i) => i.libraryId === l.id).length} 条 ·{" "}
            {
              items.filter(
                (i) => i.libraryId === l.id && i.nextReviewAt <= Date.now(),
              ).length
            }{" "}
            条待复习
          </small>
        </span>
        <Icon>›</Icon>
      </button>
      <button
        className="tree-lib-delete"
        aria-label={`删除知识库 ${l.name}`}
        onClick={(e) => {
          e.stopPropagation();
          setLibraryToDelete(l);
        }}
      >
        删除
      </button>
      <button className="tree-lib-move" onClick={(e) => { e.stopPropagation(); setMoveTargetId(l.groupId || ""); setLibraryToMove(l); }}>
        移动
      </button>
    </div>
  );
  return (
    <Layout>
      <div className="page-top">
        <h1>知识库</h1>
        <div className="page-actions">
          <button
            className="text-button"
            onClick={() => {
              setFormError("");
              setShowGroupForm(true);
            }}
          >
            ＋ 新建分类
          </button>
          <button
            className="text-button"
            onClick={() => {
              setFormError("");
              setShowLibraryForm(true);
            }}
          >
            ＋ 新建知识库
          </button>
          <button className="text-button" onClick={() => nav("/add")}>
            ＋ 添加内容
          </button>
        </div>
      </div>
      <div className="tree-list">
        {groups.filter((g) => !g.parentId).map((g) => {
          const renderGroup = (group: LibraryGroup, depth = 0): React.ReactNode => (
          <section className={`group-section category-depth-${depth}`} key={group.id}>
            <div className="group-head">
              <button
                onClick={() =>
                  setSelectedGroup(selectedGroup === group.id ? "" : group.id)
                }
              >
                <span className="caret">
                  {selectedGroup === group.id ? "▾" : "▸"}
                </span>
                <strong>{group.name}</strong>
                <small>
                  {libs.filter((l) => l.groupId === group.id).length} 个知识库
                </small>
              </button>
              <span>
                <button className="tiny-action" onClick={() => { setParentGroupId(group.id); setGroupName(""); setFormError(""); setShowGroupForm(true); }}>
                  新建子分类
                </button>
                <button className="tiny-action" onClick={() => renameGroup(group)}>
                  重命名
                </button>
                <button
                  className="tiny-action danger-text"
                  onClick={() => deleteGroup(group)}
                >
                  删除
                </button>
              </span>
            </div>
            <div className="group-items">
              {libs.filter((l) => l.groupId === group.id).map(renderLib)}
            </div>
            {groups.filter((child) => child.parentId === group.id).map((child) => renderGroup(child, depth + 1))}
          </section>
          );
          return renderGroup(g);
        })}
        <section className="group-section">
          <div className="group-head">
            <button>
              <span className="caret">○</span>
              <strong>未分类</strong>
              <small>{libs.filter((l) => !l.groupId).length} 个知识库</small>
            </button>
          </div>
          <div className="group-items">
            {libs.filter((l) => !l.groupId).map(renderLib)}
          </div>
        </section>
      </div>
      {libraryToMove && (
        <div className="modal-backdrop" onClick={() => setLibraryToMove(null)}>
          <div className="modal compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head modal-head"><h2>移动知识库</h2><button className="icon-button" onClick={() => setLibraryToMove(null)}>×</button></div>
            <p className="modal-copy">将“{libraryToMove.name}”移动到：</p>
            <label className="field"><span>目标分类</span><select value={moveTargetId} onChange={(e) => setMoveTargetId(e.target.value)}><option value="">未分类</option>{groups.map((group) => { const parent = group.parentId ? groups.find((candidate) => candidate.id === group.parentId) : undefined; return <option key={group.id} value={group.id}>{parent ? `${parent.name} / ${group.name}` : group.name}</option>; })}</select></label>
            <div className="modal-actions"><Button secondary onClick={() => setLibraryToMove(null)}>取消</Button><Button onClick={() => void moveLibrary()}>确认移动</Button></div>
          </div>
        </div>
      )}
      {showGroupForm && (
        <div className="modal-backdrop" onClick={() => setShowGroupForm(false)}>
          <div className="modal compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head modal-head">
              <h2>新建分类</h2>
              <button className="icon-button" onClick={() => setShowGroupForm(false)}>
                ×
              </button>
            </div>
            <label className="field">
              <span>分类名称</span>
              <input
                autoFocus
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="例如：政治、数学、英语"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createGroup();
                }}
              />
            </label>
            <label className="field">
              <span>上级分类（可选）</span>
              <select value={parentGroupId} onChange={(event) => setParentGroupId(event.target.value)}>
                <option value="">顶级分类</option>
                {groups.filter((group) => !group.parentId).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            {formError && <div className="error-box">{formError}</div>}
            <div className="modal-actions">
              <Button secondary onClick={() => setShowGroupForm(false)}>取消</Button>
              <Button onClick={() => void createGroup()}>创建分类</Button>
            </div>
          </div>
        </div>
      )}
      {showLibraryForm && (
        <div className="modal-backdrop" onClick={() => setShowLibraryForm(false)}>
          <div className="modal compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head modal-head">
              <h2>新建知识库</h2>
              <button className="icon-button" onClick={() => setShowLibraryForm(false)}>
                ×
              </button>
            </div>
            <label className="field">
              <span>知识库名称</span>
              <input
                autoFocus
                value={libraryName}
                onChange={(e) => {
                  setLibraryName(e.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="例如：考研英语词汇"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createLibrary();
                }}
              />
            </label>
            <label className="field">
              <span>所属分类</span>
              <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                <option value="">未分类</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            {formError && <div className="error-box">{formError}</div>}
            <div className="modal-actions">
              <Button secondary onClick={() => setShowLibraryForm(false)}>
                取消
              </Button>
              <Button onClick={() => void createLibrary()}>创建知识库</Button>
            </div>
          </div>
        </div>
      )}
      {libraryToDelete && (
        <div className="modal-backdrop" onClick={() => setLibraryToDelete(null)}>
          <div className="modal compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head modal-head">
              <h2>删除知识库</h2>
              <button className="icon-button" onClick={() => setLibraryToDelete(null)}>
                ×
              </button>
            </div>
            <p className="modal-copy">
              确定删除“{libraryToDelete.name}”及其中的全部内容吗？此操作不可撤销。
            </p>
            <div className="modal-actions">
              <Button secondary onClick={() => setLibraryToDelete(null)}>
                取消
              </Button>
              <button className="danger-button compact-danger" onClick={() => void deleteLibrary()}>
                删除知识库
              </button>
            </div>
          </div>
        </div>
      )}
      {groupToDelete && (
        <div className="modal-backdrop" onClick={() => setGroupToDelete(null)}>
          <div className="modal compact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-head modal-head">
              <h2>删除分类</h2>
              <button className="icon-button" onClick={() => setGroupToDelete(null)}>
                ×
              </button>
            </div>
            <p className="modal-copy">
              确定删除“{groupToDelete.name}”分类吗？其中的知识库会移动到未分类。
            </p>
            <div className="modal-actions">
              <Button secondary onClick={() => setGroupToDelete(null)}>
                取消
              </Button>
              <button className="danger-button compact-danger" onClick={() => void confirmDeleteGroup()}>
                删除分类
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function LibraryDetailV2({
  lib,
  groups,
  libs,
  items,
  onRefresh,
}: {
  lib: Library;
  groups: LibraryGroup[];
  libs: Library[];
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const libraryItems = items.filter((i) => i.libraryId === lib.id);
  const group = groups.find((g) => g.id === lib.groupId);
  const retention = libraryItems.length
    ? Math.round(
        (libraryItems.reduce((s, i) => s + retentionOf(i), 0) /
          libraryItems.length) *
          100,
      )
    : 0;
  return (
    <Layout>
      <Back title={lib.name} />
      <div className="detail-context">{group?.name || "未分类"}</div>
      <div className="stats">
        <span>▤ {libraryItems.length} 总条数</span>
        <span>
          ◷ {libraryItems.filter((i) => i.nextReviewAt <= Date.now()).length}{" "}
          待复习
        </span>
        <span>◒ {retention}% 掌握度</span>
      </div>
      <div className="detail-actions">
        <Button onClick={() => nav(`/study/setup?library=${lib.id}`)}>
          ▷ 开始背诵
        </Button>
        <button
          className="detail-toggle"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((value) => !value)}
        >
          {showDetails ? "收起详情" : "查看详情"} <span>{showDetails ? "⌃" : "⌄"}</span>
        </button>
        <button
          className="detail-secondary"
          style={{ display: showDetails ? undefined : "none" }}
          onClick={() => nav(`/records?library=${lib.id}`)}
        >
          ☷ 复习记录　›
        </button>
        <button
          className="detail-secondary"
          style={{ display: showDetails ? undefined : "none" }}
          onClick={() => nav(`/libraries/${lib.id}?items=1`)}
        >
          ☷ 全部内容　›
        </button>
        <button className="quick-add" onClick={() => nav(`/add?library=${lib.id}`)}>
          ＋ 添加内容　›
        </button>
      </div>
      <div className="section-head detail-head">
        <h2>最近复习</h2>
      </div>
      <div className="recent-list">
        {libraryItems
          .slice()
          .sort((a, b) => (b.lastReviewedAt || 0) - (a.lastReviewedAt || 0))
          .slice(0, 3)
          .map((i) => (
            <RecentRow key={i.id} item={i} lib={lib} />
          ))}
      </div>
      <div className="section-head detail-head">
        <h2>全部内容</h2>
      </div>
      <div className="item-list">
        {libraryItems.map((item, idx) => (
          <div className="item-row" key={item.id}>
            <span className="item-number">{idx + 1}</span>
            <div className="glyph-box small">{typeGlyph[item.type]}</div>
            <div className="item-preview">
              <small>{typeLabel[item.type]}</small>
              <strong>{item.question || item.content || ""}</strong>
            </div>
            <button
              className="edit-link"
              onClick={() => nav(`/add/manual?edit=${item.id}`)}
            >
              ✎
            </button>
            <button
              className="icon-button"
              onClick={async () => {
                if (!window.confirm("删除这条内容？")) return;
                await db.transaction(
                  "rw",
                  db.items,
                  db.reviewLogs,
                  async () => {
                    await db.items.delete(item.id);
                    await db.reviewLogs
                      .where("itemId")
                      .equals(item.id)
                      .delete();
                  },
                );
                onRefresh();
              }}
              aria-label="删除"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Layout>
  );
}

function AddPageV2() {
  const nav = useNavigate();
  const library =
    new URLSearchParams(useLocation().search).get("library") || "";
  const suffix = library ? `?library=${library}` : "";
  return (
    <Layout>
      <Back title="添加内容" />
      <p className="lead">请选择一种方式添加背诵内容</p>
      <div className="choice-menu">
        <button onClick={() => nav(`/add/manual${suffix}`)}>
          <div className="glyph-box">✎</div>
          <div>
            <strong>手动添加</strong>
            <span>输入一条内容，选择卡片类型</span>
          </div>
          <Icon>›</Icon>
        </button>
        <button onClick={() => nav(`/add/format${suffix}`)}>
          <div className="glyph-box">□</div>
          <div>
            <strong>格式粘贴</strong>
            <span>粘贴符合格式的文本或 JSON</span>
          </div>
          <Icon>›</Icon>
        </button>
        <button onClick={() => nav(`/add/ai${suffix}`)}>
          <div className="glyph-box">✦</div>
          <div>
            <strong>AI 整理导入</strong>
            <span>复制提示词，去外部 AI 整理后粘贴</span>
          </div>
          <Icon>›</Icon>
        </button>
      </div>
      <div className="info-note">
        提示：AI 整理功能需要先在外部 AI 工具生成 JSON。
      </div>
    </Layout>
  );
}

async function importParsedItems(libraryId: string, parsed: any) {
  const now = Date.now();
  const batchId = id("batch");
  const rows = parsed.items.map((x: any) => ({
    id: id("item"),
    libraryId,
    batchId,
    ...x,
    createdAt: now,
    updatedAt: now,
    reviewLevel: 0,
    nextReviewAt: now,
    retentionFactor: 0.6,
  }));
  await db.items.bulkAdd(rows);
  await db.libraries.update(libraryId, { updatedAt: now });
}
function FormatPastePage({
  libs,
  groups = [],
  onRefresh,
}: {
  libs: Library[];
  groups?: LibraryGroup[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const libraryParam = new URLSearchParams(useLocation().search).get("library");
  const [libraryId, setLibraryId] = useState(libraryParam || libs[0]?.id || "");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<any>();
  const validate = () => {
    setError("");
    setParsed(undefined);
    try {
      setParsed(aiImportSchema.parse(JSON.parse(normalizeJsonInput(text))));
    } catch (e: any) {
      setError(e?.issues?.[0]?.message || "JSON 格式无法解析");
    }
  };
  const submit = async () => {
    if (!parsed || !libraryId) return;
    await importParsedItems(libraryId, parsed);
    onRefresh();
    nav(`/libraries/${libraryId}`);
  };
  return (
    <Layout>
      <Back title="格式粘贴导入" />
      <div className="import-steps">
        <b>1. 请将符合格式的内容粘贴到下方</b>
        <button
          className="text-button"
          onClick={() =>
            setText(
              '{"version":1,"items":[{"type":"cloze","content":"中华人民共和国成立于{{1949年}}。"}]}',
            )
          }
        >
          查看格式示例
        </button>
      </div>
      <label className="field">
        <span>标准 JSON</span>
        <textarea
          className="json-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在这里粘贴 JSON 格式内容..."
        />
      </label>
      <div className="format-actions">
        <b>2. 检查格式</b>
        <Button secondary onClick={validate}>
          检查格式
        </Button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {parsed && (
        <div className="success-box">
          格式正确，共 {parsed.items.length} 条内容
        </div>
      )}
      <GroupLibraryPicker groups={groups} libs={libs} value={libraryId} onChange={setLibraryId} onRefresh={onRefresh} />
      <Button disabled={!parsed} onClick={submit}>
        导入（{parsed?.items.length || 0} 条）
      </Button>
    </Layout>
  );
}

function StudySetupV2({
  groups,
  libs,
  items,
}: {
  groups: LibraryGroup[];
  libs: Library[];
  items: MemoryItem[];
}) {
  const nav = useNavigate();
  const preset = new URLSearchParams(useLocation().search).get("library");
  const [resume, setResume] = useState<StudyResumeSnapshot | null>(null);
  useEffect(() => {
    const saved = readStudyResume();
    if (saved && saved.queue.length && saved.completed.length < saved.itemIds.length) setResume(saved);
  }, []);
  const [selected, setSelected] = useState<string[]>(
    preset ? [preset] : libs.map((l) => l.id),
  );
  const [range, setRange] = useState("due");
  const [manual, setManual] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<MemoryType | "all">("all");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(
    groups.map((group) => group.id),
  );
  const candidates = items.filter((i) => selected.includes(i.libraryId));
  const scopedCandidates = candidates.filter((item) =>
    (libraryFilter === "all" || item.libraryId === libraryFilter) &&
    (typeFilter === "all" || item.type === typeFilter),
  );
  const candidateIds = new Set(scopedCandidates.map((item) => item.id));
  const manualSelected = manual.filter((itemId) => candidateIds.has(itemId));
  const visibleManualCandidates = scopedCandidates.filter((item) => {
    const query = manualQuery.trim().toLowerCase();
    if (!query) return true;
    const libraryName = libs.find((library) => library.id === item.libraryId)?.name || "";
    return `${libraryName} ${item.question || item.content || ""}`.toLowerCase().includes(query);
  });
  const ids =
    range === "due"
          ? scopedCandidates.filter((i) => i.nextReviewAt <= Date.now()).map((i) => i.id)
      : range === "today"
        ? scopedCandidates.filter((i) => isToday(i.createdAt)).map((i) => i.id)
        : range === "manual"
          ? manualSelected
          : scopedCandidates.map((i) => i.id);
  const toggle = (libraryId: string) =>
    setSelected((s) =>
      s.includes(libraryId)
        ? s.filter((x) => x !== libraryId)
      : [...s, libraryId],
    );
  const toggleGroup = (groupId: string) => {
    const groupLibraryIds = libs
      .filter((library) => library.groupId === groupId)
      .map((library) => library.id);
    const isSelected = groupLibraryIds.every((id) => selected.includes(id));
    setSelected((current) =>
      isSelected
        ? current.filter((id) => !groupLibraryIds.includes(id))
        : Array.from(new Set([...current, ...groupLibraryIds])),
      );
  };
  const toggleExpandedGroup = (groupId: string) => {
    setExpandedGroups((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  };
  useEffect(() => {
    if (libraryFilter !== "all" && !selected.includes(libraryFilter)) {
      setLibraryFilter("all");
    }
  }, [libraryFilter, selected]);
  const ungroupedLibraryIds = libs.filter((library) => !library.groupId).map((library) => library.id);
  const categoryLibraryIds = libs
    .filter((library) => library.groupId && groups.some((group) => group.id === library.groupId))
    .map((library) => library.id);
  categoryLibraryIds.push(...ungroupedLibraryIds);
  const allCategoriesSelected =
    categoryLibraryIds.length > 0 && categoryLibraryIds.every((id) => selected.includes(id));
  const toggleAllCategories = () => {
    setSelected((current) =>
      allCategoriesSelected
        ? current.filter((id) => !categoryLibraryIds.includes(id))
        : Array.from(new Set([...current, ...categoryLibraryIds])),
    );
  };
  const categoryPicker = groups.length > 0 || ungroupedLibraryIds.length > 0 ? (
    <div className="category-pick-section">
      <div className="section-head compact-section-head">
        <div>
          <h2>按分类选择</h2>
          <span className="muted">一键选择分类内知识库</span>
        </div>
        <button
          type="button"
          className="text-button category-toggle-all"
          onClick={toggleAllCategories}
          disabled={!categoryLibraryIds.length}
        >
          {allCategoriesSelected ? "全不选" : "全选"}
        </button>
      </div>
      <div className="category-tree">
        {groups.map((group) => {
          const groupLibraries = libs.filter((library) => library.groupId === group.id);
          const groupLibraryIds = groupLibraries.map((library) => library.id);
          const checked = groupLibraryIds.length > 0 && groupLibraryIds.every((id) => selected.includes(id));
          const expanded = expandedGroups.includes(group.id);
          return (
            <div key={group.id} className="category-group">
              <div className="category-group-head">
                <label className="check-row category-check-row">
                  <input type="checkbox" checked={checked} onChange={() => toggleGroup(group.id)} disabled={!groupLibraryIds.length} />
                  <span>{group.name}</span>
                  <small>{groupLibraryIds.length} 个知识库</small>
                </label>
                <button type="button" className="category-expand" onClick={() => toggleExpandedGroup(group.id)} aria-label={`${expanded ? "收起" : "展开"}${group.name}`}>
                  {expanded ? "⌃" : "⌄"}
                </button>
              </div>
              {expanded && (
                <div className="category-library-list">
                  {groupLibraries.map((library) => (
                    <label key={library.id} className="check-row category-library-row">
                      <input type="checkbox" checked={selected.includes(library.id)} onChange={() => toggle(library.id)} />
                      <span>{library.name}</span>
                      <small>{items.filter((item) => item.libraryId === library.id).length} 条</small>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {ungroupedLibraryIds.length > 0 && (
          <label className="check-row category-check-row">
            <input
              type="checkbox"
              checked={ungroupedLibraryIds.every((id) => selected.includes(id))}
              onChange={() => {
                const checked = ungroupedLibraryIds.every((id) => selected.includes(id));
                setSelected((current) =>
                  checked
                    ? current.filter((id) => !ungroupedLibraryIds.includes(id))
                    : Array.from(new Set([...current, ...ungroupedLibraryIds])),
                );
              }}
            />
            <span>未分类</span>
            <small>{ungroupedLibraryIds.length} 个知识库</small>
          </label>
        )}
      </div>
    </div>
  ) : null;
  return (
    <Layout>
      {resume && (
        <div className="modal-backdrop">
          <div className="modal compact-modal">
            <div className="section-head modal-head"><h2>继续上次背诵？</h2></div>
            <p className="modal-copy">检测到一轮未完成的背诵进度，已完成 {resume.completed.length} / {resume.itemIds.length} 条。</p>
            <div className="modal-actions">
              <Button secondary onClick={() => { clearStudyResume(); setResume(null); }}>开始新一轮</Button>
              <Button onClick={() => nav("/study", { state: { resume } })}>继续背诵</Button>
            </div>
          </div>
        </div>
      )}
      <Back title="开始背诵" />
      <h2>选择方式</h2>
      <div className="study-mode-list">
        <button className="mode-card active">
          <b>单个知识库</b>
          <span>从一个知识库开始背诵</span>
          <i>◉</i>
        </button>
        <button
          className="mode-card"
          onClick={() => setSelected(libs.map((l) => l.id))}
        >
          <b>混合多个知识库</b>
          <span>从多个知识库中混合出题</span>
          <i>○</i>
        </button>
      </div>
      <div className="section-head">
        <h2>选择知识库</h2>
        <span className="muted">已选择 {selected.length} 个</span>
      </div>
      {categoryPicker}
      <div className="section-head range-head">
        <div>
          <h2>选择内容与范围</h2>
          <span className="muted">先选分类和知识库，再决定本轮取哪些内容</span>
        </div>
      </div>
      <div className="selection-summary">
        已选 {selected.length} 个知识库 · 当前筛选 {scopedCandidates.length} 条内容
      </div>
      <div className="content-filters">
        <label>
          <span>知识库</span>
          <select
            value={libraryFilter}
            onChange={(event) => setLibraryFilter(event.target.value)}
          >
            <option value="all">全部已选知识库</option>
            {groups.map((group) => {
              const groupLibraries = libs.filter(
                (library) => library.groupId === group.id && selected.includes(library.id),
              );
              return groupLibraries.length ? (
                <optgroup key={group.id} label={group.name}>
                  {groupLibraries.map((library) => (
                    <option key={library.id} value={library.id}>{library.name}</option>
                  ))}
                </optgroup>
              ) : null;
            })}
            {libs.filter((library) => !library.groupId && selected.includes(library.id)).length > 0 && (
              <optgroup label="未分类">
                {libs.filter((library) => !library.groupId && selected.includes(library.id)).map((library) => (
                  <option key={library.id} value={library.id}>{library.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label>
          <span>内容形式</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as MemoryType | "all")}>
            <option value="all">全部形式</option>
            <option value="recall">回忆卡</option>
            <option value="cloze">遮挡卡</option>
            <option value="choice">选择题</option>
          </select>
        </label>
      </div>
      <div className="range-grid">
        {[
          ["due", "今日应复习", "今天到期的内容"],
          ["all", "全部", "所有内容"],
          ["today", "今日新加入", "今天添加的内容"],
          ["manual", "手动选择", "从已选分类中挑选"],
        ].map(([v, t, s]) => (
          <button
            key={v}
            className={range === v ? "range-card active" : "range-card"}
            onClick={() => {
              setRange(v);
              if (v === "manual") setShowManual(true);
            }}
          >
            <strong>{t}</strong>
            <span>{s}</span>
          </button>
        ))}
      </div>
      {range === "manual" && (
        <button className="text-button" onClick={() => setShowManual(true)}>
          已选择 {manualSelected.length} 条 ›
        </button>
      )}
      {showManual && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="section-head">
              <div>
                <h2>手动选择内容</h2>
          <span className="muted">仅显示当前筛选范围内的内容</span>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowManual(false)}
              >
                ×
              </button>
            </div>
            <input className="manual-search" value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="在当前筛选结果中搜索" />
            <div className="manual-toolbar">
              <span>已选 {manualSelected.length} / {candidates.length}</span>
              <button type="button" className="text-button" onClick={() => {
                const visibleIds = visibleManualCandidates.map((item) => item.id);
                const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => manual.includes(id));
                setManual((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
              }}>{visibleManualCandidates.length > 0 && visibleManualCandidates.every((item) => manual.includes(item.id)) ? "取消全选当前结果" : "全选当前结果"}</button>
            </div>
            <div className="manual-list">
              {visibleManualCandidates.map((i) => (
                <label className="check-row" key={i.id}>
                  <input
                    type="checkbox"
                    checked={manual.includes(i.id)}
                    onChange={() =>
                      setManual((s) =>
                        s.includes(i.id)
                          ? s.filter((x) => x !== i.id)
                          : [...s, i.id],
                      )
                    }
                  />
                  <span>
                    <b>{libs.find((library) => library.id === i.libraryId)?.name || "知识库"}</b>
                    <small>{i.question || i.content}</small>
                  </span>
                </label>
              ))}
            </div>
            <Button onClick={() => setShowManual(false)}>完成</Button>
          </div>
        </div>
      )}
      <div className="session-count">
        本次将复习 <b>{ids.length}</b> 条内容
      </div>
      <Button
        disabled={!selected.length || !ids.length}
        onClick={() => nav("/study", { state: { itemIds: ids } })}
      >
        开始背诵
      </Button>
      {!ids.length && <div className="muted-center">没有符合条件的内容</div>}
    </Layout>
  );
}

type SessionState = {
  itemId: string;
  attempts: number;
  worstRating: ReviewRating;
  reinforcementCount: number;
};
function StudyQueueV2({
  items,
  onRefresh,
}: {
  items: MemoryItem[];
  onRefresh: () => void;
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const routeState = loc.state as { itemIds?: string[]; resume?: StudyResumeSnapshot } | null;
  const resumed = routeState?.resume;
  const initial = resumed?.itemIds || routeState?.itemIds || [];
  const [queue, setQueue] = useState(resumed?.queue || initial);
  const [session, setSession] = useState<Record<string, SessionState>>(resumed?.session || {});
  const [completed, setCompleted] = useState<ReviewLog[]>(resumed?.completed || []);
  const [revealed, setRevealed] = useState(resumed?.revealed || false);
  const [selected, setSelected] = useState<number | undefined>(resumed?.selected);
  const current = items.find((i) => i.id === queue[0]);
  const total = new Set(initial).size;
  const saveResume = (nextQueue = queue, nextSession = session, nextCompleted = completed, nextRevealed = revealed, nextSelected = selected) => {
    if (!initial.length || nextCompleted.length >= total) return;
    const snapshot: StudyResumeSnapshot = {
      itemIds: initial,
      queue: nextQueue,
      session: nextSession,
      completed: nextCompleted,
      revealed: nextRevealed,
      selected: nextSelected,
      savedAt: Date.now(),
    };
    localStorage.setItem(STUDY_RESUME_KEY, JSON.stringify(snapshot));
  };
  const finish = (logs: ReviewLog[], ended = false) => {
    if (ended) saveResume();
    else clearStudyResume();
    return nav("/study/complete", {
      state: {
        stats: aggregateLogs(logs),
        total,
        completed: logs.length,
        ended,
      },
    });
  };
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") saveResume();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  });
  const rate = async (rating: ReviewRating) => {
    if (!current) return;
    const previous = session[current.id] || {
      itemId: current.id,
      attempts: 0,
      worstRating: "good" as ReviewRating,
      reinforcementCount: 0,
    };
    const nextState = {
      itemId: current.id,
      attempts: previous.attempts + 1,
      worstRating:
        severity[rating] > severity[previous.worstRating]
          ? rating
          : previous.worstRating,
      reinforcementCount:
        previous.reinforcementCount + (rating === "good" ? 0 : 1),
    };
    const nextSession = { ...session, [current.id]: nextState };
    setSession(nextSession);
    if (rating !== "good") {
      const nextQueue = [...queue.slice(1), current.id];
      setQueue(nextQueue);
      setRevealed(false);
      setSelected(undefined);
      saveResume(nextQueue, nextSession, completed, false, undefined);
      return;
    }
    const now = Date.now();
    const log: ReviewLog = {
      id: id("review"),
      itemId: current.id,
      libraryId: current.libraryId,
      reviewedAt: now,
      result: nextState.worstRating,
      attempts: nextState.attempts,
      reinforcementCount: nextState.reinforcementCount,
    };
    await db.transaction("rw", db.items, db.reviewLogs, async () => {
      await db.items.put(applyReview(current, nextState.worstRating, now));
      await db.reviewLogs.add(log);
    });
    onRefresh();
    const logs = [...completed, log];
    setCompleted(logs);
    const nextQueue = queue.slice(1);
    setQueue(nextQueue);
    setRevealed(false);
    setSelected(undefined);
    if (queue.length <= 1) finish(logs);
    else saveResume(nextQueue, nextSession, logs, false, undefined);
  };
  if (!initial.length || !current)
    return (
      <Layout>
        <Empty
          title="没有可复习内容"
          action={<Button onClick={() => nav("/study/setup")}>返回设置</Button>}
        />
      </Layout>
    );
  return (
    <Layout>
      <div className="study-header">
        <button className="icon-button" onClick={() => finish(completed, true)}>
          ×
        </button>
        <div>
          <b>
            {completed.length} / {total}
          </b>
          <small>本轮唯一条目进度</small>
        </div>
        <button className="text-button" onClick={() => finish(completed, true)}>
          结束本轮
        </button>
      </div>
      <div className="study-progress">
        <i
          style={{ width: `${(completed.length / Math.max(total, 1)) * 100}%` }}
        />
      </div>
      <div className="study-library">{typeLabel[current.type]}</div>
      <div
        className="study-card"
        onClick={() => current.type !== "choice" && setRevealed(true)}
      >
        {current.imageDataUrl && (
          <img className="study-image" src={current.imageDataUrl} alt="" />
        )}
        <div className="study-prompt">
          {current.type === "cloze" ? (
            <ClozeText content={current.content || ""} revealed={revealed} />
          ) : (
            <RichText text={current.question || ""} />
          )}
        </div>
        {current.type === "recall" && revealed && (
          <div className="study-answer">
            <RichText text={current.answer || ""} />
          </div>
        )}
        {current.type === "choice" && (
          <div className="study-options">
            {(current.options || []).map((o, i) => (
              <button
                key={i}
                className={
                  selected !== undefined
                    ? i === current.correctIndex
                      ? "correct"
                      : i === selected
                        ? "wrong"
                        : ""
                    : ""
                }
                onClick={() => {
                  setSelected(i);
                  setRevealed(true);
                }}
              >
                {String.fromCharCode(65 + i)}. {o}
              </button>
            ))}
          </div>
        )}
        {!revealed && current.type !== "choice" && (
          <span className="tap-hint">点击卡片查看答案</span>
        )}
      </div>
      <div className="study-rating-bar">
        {(["again", "hard", "good"] as ReviewRating[]).map((r) => (
          <button
            key={r}
            disabled={!revealed}
            className={`rating ${r}`}
            onClick={() => rate(r)}
          >
            {ratingText[r]}
          </button>
        ))}
      </div>
    </Layout>
  );
}

function StudyCompleteV2({ onRefresh }: { onRefresh: () => void }) {
  const nav = useNavigate();
  const state = useLocation().state as {
    stats?: ReturnType<typeof aggregateLogs>;
    total?: number;
    completed?: number;
    ended?: boolean;
  } | null;
  const stats = state?.stats || {
    reviewedCount: 0,
    goodCount: 0,
    hardCount: 0,
    againCount: 0,
    reinforcementCount: 0,
  };
  const [checked, setChecked] = useState(false);
  const checkin = async () => {
    const logs = await db.reviewLogs
      .where("reviewedAt")
      .between(dayStart(), Date.now(), true, true)
      .toArray();
    const s = aggregateLogs(logs);
    await db.dailyCheckins.put({
      dateKey: dateKey(Date.now()),
      checkedAt: Date.now(),
      ...s,
    });
    setChecked(true);
    onRefresh();
  };
  return (
    <Layout>
      <div className="complete">
        <div className="complete-mark">✓</div>
        <h1>{state?.ended ? "本轮已结束" : "本轮完成"}</h1>
        <p>
          {state?.ended
            ? `已完成 ${state?.completed || 0} / ${state?.total || 0} 条唯一内容`
            : `共复习 ${state?.total || stats.reviewedCount} 条唯一内容`}
        </p>
        <div className="result-grid">
          <div>
            <b>{stats.goodCount}</b>
            <span>认识</span>
          </div>
          <div>
            <b>{stats.hardCount}</b>
            <span>模糊</span>
          </div>
          <div>
            <b>{stats.againCount}</b>
            <span>忘记</span>
          </div>
        </div>
        <div className="reinforce-row">
          ◌ 强化复习　{stats.reinforcementCount} 次
        </div>
        <Button onClick={() => nav("/study/setup")}>继续背诵</Button>
        <Button secondary disabled={checked} onClick={checkin}>
          {checked ? "今日已打卡" : "今日打卡"}
        </Button>
      </div>
    </Layout>
  );
}

function RecordsV2({
  groups,
  libs,
  items,
  logs,
  checkins,
}: {
  groups: LibraryGroup[];
  libs: Library[];
  items: MemoryItem[];
  logs: ReviewLog[];
  checkins: DailyCheckin[];
}) {
  const loc = useLocation();
  const queryFilter = new URLSearchParams(loc.search).get("library") || "all";
  const [tab, setTab] = useState<"overview" | "calendar">("overview");
  const [filter, setFilter] = useState(queryFilter);
  const [selectedDate, setSelectedDate] = useState(dateKey(Date.now()));
  useEffect(() => {
    setFilter(queryFilter);
  }, [queryFilter]);
  const matchesFilter = (libraryId: string) =>
    filter === "all" ||
    libraryId === filter ||
    libs.find((l) => l.id === libraryId)?.groupId === filter;
  const filteredLogs = logs.filter((l) => matchesFilter(l.libraryId));
  const focusItems = items.filter((i) => matchesFilter(i.libraryId));
  const days30 = lastDays(30);
  const days14 = lastDays(14);
  const heat = days30.map(
    (d) => filteredLogs.filter((l) => dateKey(l.reviewedAt) === d).length,
  );
  const pressure = lastDays(7).map(
    (d) => focusItems.filter((i) => dateKey(i.nextReviewAt) === d).length,
  );
  const avg = focusItems.length
    ? Math.round(
        (focusItems.reduce((s, i) => s + retentionOf(i), 0) /
          focusItems.length) *
          100,
      )
    : 0;
  const detailLogs = filteredLogs.filter(
    (l) => dateKey(l.reviewedAt) === selectedDate,
  );
  const detailAdds = focusItems.filter(
    (i) => dateKey(i.createdAt) === selectedDate,
  );
  const detailAddSummary = Array.from(
    detailAdds.reduce((summary, item) => {
      const current = summary.get(item.libraryId) || { count: 0, latest: item.createdAt };
      summary.set(item.libraryId, {
        count: current.count + 1,
        latest: Math.max(current.latest, item.createdAt),
      });
      return summary;
    }, new Map<string, { count: number; latest: number }>()),
  )
    .map(([libraryId, value]) => ({ libraryId, ...value }))
    .sort((a, b) => b.latest - a.latest);
  const days7 = lastDays(7);
  return (
    <Layout>
      <div className="page-top">
        <h1>记录</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">全部</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
          {libs.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          概览
        </button>
        <button
          className={tab === "calendar" ? "active" : ""}
          onClick={() => setTab("calendar")}
        >
          日历
        </button>
      </div>
      {tab === "overview" ? (
        <>
          <section className="record-chart">
            <div className="section-head">
              <h2>30 天学习热力图</h2>
              <span className="muted">{checkins.length} 次打卡</span>
            </div>
            <div className="heatmap">
              {days30.map((d, i) => (
                <button
                  key={d}
                  title={d}
                  className={`heat heat-${Math.min(4, Math.ceil(heat[i] / 3))}`}
                  onClick={() => {
                    setSelectedDate(d);
                    setTab("calendar");
                  }}
                />
              ))}
            </div>
          </section>
          <section className="record-chart">
            <div className="section-head">
              <h2>最近 14 天掌握情况</h2>
            </div>
            <div className="stack-bars">
              {days14.map((d) => {
                const ls = filteredLogs.filter(
                  (l) => dateKey(l.reviewedAt) === d,
                );
                const total = Math.max(ls.length, 1);
                return (
                  <div className="stack-day" key={d}>
                    <div>
                      <i
                        className="good"
                        style={{
                          height: `${(ls.filter((x) => x.result === "good").length / total) * 100}%`,
                        }}
                      />
                      <i
                        className="hard"
                        style={{
                          height: `${(ls.filter((x) => x.result === "hard").length / total) * 100}%`,
                        }}
                      />
                      <i
                        className="again"
                        style={{
                          height: `${(ls.filter((x) => x.result === "again").length / total) * 100}%`,
                        }}
                      />
                    </div>
                    <small>{new Date(`${d}T00:00:00`).getDate()}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="record-chart">
            <div className="section-head">
              <h2>记忆保持</h2>
              <b>当前预计保持度 {avg}%</b>
            </div>
            <RetentionChart items={focusItems} />
          </section>
          <section className="record-chart">
            <div className="section-head">
              <h2>未来 7 天复习压力</h2>
            </div>
            <MiniBars
              values={pressure}
              labels={lastDays(7).map((d) =>
                new Date(`${d}T00:00:00`).getDate().toString(),
              )}
            />
          </section>
          <section className="record-chart">
            <div className="section-head">
              <h2>最近 7 天新增</h2>
              <span className="muted">按知识库统计</span>
            </div>
            <div className="add-history">
              {days7.slice().reverse().map((day) => {
                const dayItems = focusItems.filter((item) => dateKey(item.createdAt) === day);
                const byLibrary = Array.from(
                  dayItems.reduce((summary, item) => {
                    summary.set(item.libraryId, (summary.get(item.libraryId) || 0) + 1);
                    return summary;
                  }, new Map<string, number>()),
                );
                return (
                  <button
                    className="add-history-row"
                    key={day}
                    onClick={() => {
                      setSelectedDate(day);
                      setTab("calendar");
                    }}
                  >
                    <span>
                      <strong>{dateLabel(day)}</strong>
                      <small>
                        {byLibrary.length
                          ? byLibrary
                              .map(([libraryId, count]) => `${libs.find((library) => library.id === libraryId)?.name || "知识库"} ${count} 条`)
                              .join(" · ")
                          : "无新增内容"}
                      </small>
                    </span>
                    <b>{dayItems.length} 条</b>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="calendar-strip">
            {days30.map((d) => (
              <button
                key={d}
                className={selectedDate === d ? "active" : ""}
                onClick={() => setSelectedDate(d)}
              >
                <span>
                  {new Date(`${d}T00:00:00`).getMonth() + 1}/
                  {new Date(`${d}T00:00:00`).getDate()}
                </span>
                <i />
              </button>
            ))}
          </div>
          <h2>{dateLabel(selectedDate)}</h2>
          <div className="day-summary">
            复习 {detailLogs.length} 条 · 新增 {detailAdds.length} 条 · 强化{" "}
            {detailLogs.reduce((n, x) => n + x.reinforcementCount, 0)} 次
          </div>
          {detailAddSummary.length > 0 && (
            <section className="day-record-block">
              <div className="section-head day-record-head">
                <h3>当天新增</h3>
                <span>{detailAdds.length} 条</span>
              </div>
              <div className="stack">
                {detailAddSummary.map(({ libraryId, count }) => (
                  <div className="batch-row" key={`add-${libraryId}`}>
                    <div>
                      <strong>{libs.find((library) => library.id === libraryId)?.name || "知识库"}</strong>
                      <span>新增内容</span>
                    </div>
                    <b>{count} 条</b>
                  </div>
                ))}
              </div>
            </section>
          )}
          {detailLogs.length > 0 && (
            <section className="day-record-block">
              <div className="section-head day-record-head">
                <h3>复习记录</h3>
                <span>{detailLogs.length} 条</span>
              </div>
              <div className="stack">
                {detailLogs.map((l) => (
                  <div className="batch-row" key={l.id}>
                    <div>
                      <strong>
                        {libs.find((x) => x.id === l.libraryId)?.name || "知识库"}
                      </strong>
                      <span>
                        {ratingText[l.result]} · {l.attempts} 次尝试
                      </span>
                    </div>
                    <span>{l.reinforcementCount} 次强化</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {!detailLogs.length && !detailAdds.length && (
            <Empty title="这一天还没有学习或添加记录" />
          )}
        </>
      )}
    </Layout>
  );
}

function LegacyApp() {
  const [libs, setLibs] = useState<Library[]>([]);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const loc = useLocation();
  const refresh = async () => {
    setLibs(await db.libraries.toArray());
    setItems(await db.items.toArray());
  };
  useEffect(() => {
    refresh().then(() => setReady(true));
  }, []);
  if (!ready) return <div className="loading">正在加载 Recall Lite…</div>;
  const path = loc.pathname;
  let page: React.ReactNode;
  if (path === "/") page = <Home libs={libs} items={items} />;
  else if (path === "/libraries")
    page = <Libraries libs={libs} items={items} onRefresh={refresh} />;
  else if (path.startsWith("/libraries/")) {
    const lib = libs.find((l) => l.id === path.split("/")[2]);
    page = lib ? (
      <LibraryDetail lib={lib} items={items} onRefresh={refresh} />
    ) : (
      <Empty title="知识库不存在" />
    );
  } else if (path === "/add") page = <AddPage />;
  else if (path === "/add/manual")
    page = <ManualPage libs={libs} items={items} onRefresh={refresh} />;
  else if (path === "/add/ai")
    page = <AiPage libs={libs} onRefresh={refresh} />;
  else if (path === "/study/setup") page = <Setup libs={libs} items={items} />;
  else if (path === "/study")
    page = <Study items={items} onRefresh={refresh} />;
  else if (path === "/records") page = <Records items={items} libs={libs} />;
  else if (path === "/settings")
    page = <Settings libs={libs} items={items} onRefresh={refresh} />;
  else page = <Home libs={libs} items={items} />;
  return page;
}

export default function App() {
  const [groups, setGroups] = useState<LibraryGroup[]>([]);
  const [libs, setLibs] = useState<Library[]>([]);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [ready, setReady] = useState(false);
  const loc = useLocation();
  const refresh = async () => {
    const [g, l, i, r, c] = await Promise.all([
      db.libraryGroups.toArray(),
      db.libraries.toArray(),
      db.items.toArray(),
      db.reviewLogs.toArray(),
      db.dailyCheckins.toArray(),
    ]);
    setGroups(g);
    setLibs(l);
    setItems(i);
    setLogs(r);
    setCheckins(c);
  };
  useEffect(() => {
    refresh().then(() => setReady(true));
  }, []);
  if (!ready) return <div className="loading">正在加载 Recall Lite…</div>;
  const path = loc.pathname;
  let page: React.ReactNode;
  if (path === "/")
    page = (
      <HomeV2
        groups={groups}
        libs={libs}
        items={items}
        logs={logs}
        checkins={checkins}
      />
    );
  else if (path === "/libraries")
    page = (
      <LibrariesV2
        groups={groups}
        libs={libs}
        items={items}
        onRefresh={refresh}
      />
    );
  else if (path.startsWith("/libraries/")) {
    const lib = libs.find((l) => l.id === path.split("/")[2]);
    page = lib ? (
      <LibraryDetailV2
        lib={lib}
        groups={groups}
        libs={libs}
        items={items}
        onRefresh={refresh}
      />
    ) : (
      <Empty title="知识库不存在" />
    );
  } else if (path === "/add") page = <AddPageV2 />;
  else if (path === "/add/manual")
    page = <ManualPage groups={groups} libs={libs} items={items} onRefresh={refresh} />;
  else if (path === "/add/format")
    page = <FormatPastePage groups={groups} libs={libs} onRefresh={refresh} />;
  else if (path === "/add/ai")
    page = <AiPage groups={groups} libs={libs} onRefresh={refresh} />;
  else if (path === "/study/setup")
    page = <StudySetupV2 groups={groups} libs={libs} items={items} />;
  else if (path === "/study")
    page = <StudyQueueV2 items={items} onRefresh={refresh} />;
  else if (path === "/study/complete")
    page = <StudyCompleteV2 onRefresh={refresh} />;
  else if (path === "/records")
    page = (
      <RecordsV2
        groups={groups}
        libs={libs}
        items={items}
        logs={logs}
        checkins={checkins}
      />
    );
  else if (path === "/settings")
    page = <Settings libs={libs} items={items} onRefresh={refresh} />;
  else
    page = (
      <HomeV2
        groups={groups}
        libs={libs}
        items={items}
        logs={logs}
        checkins={checkins}
      />
    );
  return page;
}
