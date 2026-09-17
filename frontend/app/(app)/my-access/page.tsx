'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { LEVELS } from '@/lib/format';
import type { UserAccessSummary } from '@/lib/types';
import { useMe } from '@/components/AppShell';
import { LevelBadge } from '@/components/PermissionLevel';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState, PageHeader } from '@/components/ui/Display';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { SearchInput } from '@/components/ui/Toolbar';

export default function MyAccessPage() {
  const me = useMe();
  const toast = useToast();
  const [data, setData] = useState<UserAccessSummary>({ projects: [], resources: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'WRITE' | 'READ'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [cmdCopied, setCmdCopied] = useState(false);

  const loadAccess = async () => {
    setLoading(true);
    try {
      const res = await api<UserAccessSummary>('/my/access');
      setData(res);
    } catch (err) {
      toast.error('Không tải được thông tin quyền truy cập', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, []);

  const copyPath = (path: string) => {
    if (!path) return;
    navigator.clipboard.writeText(path).then(
      () => {
        setCopiedPath(path);
        toast.success('Đã sao chép đường dẫn', path);
        setTimeout(() => setCopiedPath(null), 2500);
      },
      () => toast.error('Không sao chép được', 'Hãy bôi đen và sao chép thủ công.'),
    );
  };

  const copyNetUseCommand = (path: string) => {
    const p = path || '\\\\fileserver\\projects';
    const cmd = `net use Z: "${p}" /persistent:yes`;
    navigator.clipboard.writeText(cmd).then(
      () => {
        setCmdCopied(true);
        toast.success('Đã sao chép lệnh gán ổ đĩa', cmd);
        setTimeout(() => setCmdCopied(false), 2500);
      },
      () => toast.error('Không sao chép được', 'Hãy bôi đen và sao chép thủ công.'),
    );
  };

  const filteredProjects = useMemo(() => {
    let list = data.projects;
    if (filterLevel === 'WRITE') {
      list = list.filter((p) => p.level === 'WRITE' || p.level === 'W');
    } else if (filterLevel === 'READ') {
      list = list.filter((p) => p.level === 'READ' || p.level === 'R');
    }

    const q = query.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.project_name.toLowerCase().includes(q) ||
        p.project_code.toLowerCase().includes(q) ||
        p.company_name.toLowerCase().includes(q) ||
        p.folder_path.toLowerCase().includes(q),
    );
  }, [data.projects, query, filterLevel]);

  const filteredResources = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return data.resources;
    return data.resources.filter(
      (r) =>
        r.resource_name.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q) ||
        r.path.toLowerCase().includes(q),
    );
  }, [data.resources, query]);

  const writeCount =
    data.projects.filter((p) => p.level === 'WRITE' || p.level === 'W').length +
    data.resources.filter((r) => r.level === 'WRITE' || r.level === 'W').length;
  const readCount =
    data.projects.filter((p) => p.level === 'READ' || p.level === 'R').length +
    data.resources.filter((r) => r.level === 'READ' || r.level === 'R').length;

  return (
    <div className="portal-container">
      {/* Top Welcome Banner */}
      <div className="portal-hero">
        <div className="portal-hero-main">
          <div className="portal-hero-greeting">
            <div className="portal-eyebrow">
              <span className="live-pulse" />
              <span>Hệ thống Phân quyền File Server Nội bộ</span>
            </div>
            <h1 className="portal-title">
              Xin chào, <span className="highlight-name">{me?.full_name ?? 'Nhân viên'}</span> 👋
            </h1>
            <p className="portal-subtitle">
              Dưới đây là danh sách các dự án và thư mục mạng bạn được phân quyền truy cập. Bạn có thể mở trực tiếp từ Windows File Explorer hoặc kết nối thành ổ đĩa mạng.
            </p>
          </div>

          <div className="portal-hero-badges">
            {me?.employee_code && (
              <span className="info-chip">
                <Icon name="key" size={13} />
                <span>Mã NV: <strong>{me.employee_code}</strong></span>
              </span>
            )}
            {me?.company_name && (
              <span className="info-chip">
                <Icon name="building" size={13} />
                <span>{me.company_name}</span>
              </span>
            )}
            <span className="status-chip success">
              <Icon name="circle-check" size={13} />
              <span>Đang hoạt động</span>
            </span>
          </div>
        </div>

        <div className="portal-hero-actions">
          <Button variant="secondary" icon="refresh-cw" onClick={loadAccess} loading={loading} className="btn-elevated">
            Làm mới
          </Button>
          <a href="#quick-guide" className="btn btn-primary btn-elevated">
            <Icon name="network" size={16} />
            <span>Hướng dẫn kết nối</span>
          </a>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="bento-grid">
        <div className="bento-card bento-primary">
          <div className="bento-card-top">
            <span className="bento-label">Dự án được cấp quyền</span>
            <div className="bento-icon-glow icon-blue">
              <Icon name="folder" size={22} />
            </div>
          </div>
          <div className="bento-value">{data.projects.length}</div>
          <div className="bento-foot">
            <Icon name="grid" size={14} />
            <span>Dự án File Server khả dụng</span>
          </div>
        </div>

        <div className="bento-card bento-write">
          <div className="bento-card-top">
            <span className="bento-label">Quyền Chỉnh sửa (Write - W)</span>
            <div className="bento-icon-glow icon-indigo">
              <Icon name="pencil" size={22} />
            </div>
          </div>
          <div className="bento-value text-indigo">{writeCount}</div>
          <div className="bento-foot">
            <Icon name="check" size={14} />
            <span>Được xem, tạo mới &amp; chỉnh sửa file</span>
          </div>
        </div>

        <div className="bento-card bento-read">
          <div className="bento-card-top">
            <span className="bento-label">Quyền Chỉ xem (Read - R)</span>
            <div className="bento-icon-glow icon-emerald">
              <Icon name="eye" size={22} />
            </div>
          </div>
          <div className="bento-value text-emerald">{readCount}</div>
          <div className="bento-foot">
            <Icon name="info" size={14} />
            <span>Chỉ xem và tải xuống tài liệu</span>
          </div>
        </div>
      </div>

      {/* Main Projects Section */}
      <div className="portal-section">
        <div className="section-head">
          <div className="section-title-wrap">
            <h2 className="section-title">Danh mục Dự án &amp; Thư mục File Server</h2>
            <p className="section-desc">Bấm sao chép đường dẫn UNC để dán vào hộp thoại Run (Win + R) hoặc File Explorer</p>
          </div>

          <div className="view-toggle">
            <button
              type="button"
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Dạng bảng chi tiết"
            >
              <Icon name="list" size={16} />
              <span>Bảng</span>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Dạng lưới thẻ"
            >
              <Icon name="grid" size={16} />
              <span>Thẻ</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="explorer-toolbar">
          <div className="search-box-wrap">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Tìm theo tên dự án, mã dự án, đường dẫn UNC..."
            />
          </div>

          <div className="filter-pills">
            <button
              type="button"
              className={`filter-pill ${filterLevel === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterLevel('ALL')}
            >
              Tất cả ({data.projects.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${filterLevel === 'WRITE' ? 'active' : ''}`}
              onClick={() => setFilterLevel('WRITE')}
            >
              <span className="dot dot-write" />
              Chỉnh sửa (W)
            </button>
            <button
              type="button"
              className={`filter-pill ${filterLevel === 'READ' ? 'active' : ''}`}
              onClick={() => setFilterLevel('READ')}
            >
              <span className="dot dot-read" />
              Chỉ xem (R)
            </button>
          </div>

          <div className="explorer-counter">
            <strong>{filteredProjects.length}</strong> / {data.projects.length} dự án
          </div>
        </div>

        {/* Projects Content: Table or Cards */}
        {loading ? (
          <div className="portal-loading">
            <span className="spinner spinner-lg" />
            <p>Đang tải danh sách quyền truy cập...</p>
          </div>
        ) : !filteredProjects.length ? (
          <div className="portal-empty-wrap">
            <EmptyState
              icon="shield"
              title="Không tìm thấy dự án phù hợp"
              description={query ? 'Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc mức quyền.' : 'Bạn hiện chưa được cấp quyền vào dự án nào trên File Server. Hãy liên hệ Quản trị viên để được cấp quyền.'}
            />
          </div>
        ) : viewMode === 'table' ? (
          <div className="card table-card-elevated">
            <div className="table-scroll">
              <table className="data-table-modern">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px' }}>Dự án &amp; Mã</th>
                    <th>Công ty</th>
                    <th style={{ width: '150px' }}>Mức quyền</th>
                    <th>Đường dẫn File Server (UNC Path)</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => (
                    <tr key={p.project_id} className="project-row">
                      <td>
                        <div className="project-cell">
                          <div className="project-avatar-box">
                            <Icon name="folder" size={18} />
                          </div>
                          <div>
                            <strong className="project-name">{p.project_name}</strong>
                            <div className="project-code-row">
                              <span className="code-badge">{p.project_code}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="company-badge">{p.company_name}</span>
                      </td>
                      <td>
                        <LevelBadge entry={{ level: p.level, levels: [p.level], conflict: false }} />
                      </td>
                      <td>
                        {p.folder_path ? (
                          <div className="unc-path-box">
                            <code className="unc-code">{p.folder_path}</code>
                          </div>
                        ) : (
                          <span className="muted-italic">Chưa khai báo đường dẫn UNC</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {p.folder_path && (
                          <button
                            type="button"
                            className={`btn-copy-action ${copiedPath === p.folder_path ? 'copied' : ''}`}
                            onClick={() => copyPath(p.folder_path)}
                            title="Sao chép đường dẫn mạng để mở trong Windows"
                          >
                            <Icon name={copiedPath === p.folder_path ? 'check' : 'copy'} size={14} />
                            <span>{copiedPath === p.folder_path ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="project-cards-grid">
            {filteredProjects.map((p) => (
              <div key={p.project_id} className="project-card-item">
                <div className="project-card-header">
                  <div className="project-card-icon">
                    <Icon name="folder" size={20} />
                  </div>
                  <LevelBadge entry={{ level: p.level, levels: [p.level], conflict: false }} />
                </div>

                <div className="project-card-body">
                  <h3 className="project-card-name" title={p.project_name}>{p.project_name}</h3>
                  <div className="project-card-meta">
                    <span className="code-badge">{p.project_code}</span>
                    <span className="meta-separator">•</span>
                    <span className="company-label">{p.company_name}</span>
                  </div>

                  <div className="project-card-unc">
                    <span className="unc-label">Đường dẫn UNC:</span>
                    {p.folder_path ? (
                      <div className="unc-block">
                        <code className="unc-text">{p.folder_path}</code>
                        <button
                          type="button"
                          className={`btn-unc-copy ${copiedPath === p.folder_path ? 'copied' : ''}`}
                          onClick={() => copyPath(p.folder_path)}
                          title="Sao chép đường dẫn"
                        >
                          <Icon name={copiedPath === p.folder_path ? 'check' : 'copy'} size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="muted-italic">Chưa khai báo đường dẫn</span>
                    )}
                  </div>
                </div>

                {p.folder_path && (
                  <div className="project-card-footer">
                    <button
                      type="button"
                      className="btn-full-copy"
                      onClick={() => copyPath(p.folder_path)}
                    >
                      <Icon name={copiedPath === p.folder_path ? 'check' : 'copy'} size={15} />
                      <span>{copiedPath === p.folder_path ? 'Đã sao chép vào Clipboard!' : 'Sao chép đường dẫn File Server'}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subfolder Grants (if any) */}
      {data.resources.length > 0 && (
        <div className="portal-section">
          <div className="card table-card-elevated">
            <div className="card-header-styled">
              <div className="header-icon-wrap">
                <Icon name="network" size={18} />
              </div>
              <div>
                <h3 className="card-title-modern">Thư mục con được cấp quyền riêng biệt</h3>
                <p className="card-desc-modern">Các thư mục nhánh cấp dưới có mức quyền đặc thù trong từng dự án</p>
              </div>
            </div>
            <div className="table-scroll">
              <table className="data-table-modern">
                <thead>
                  <tr>
                    <th>Tên thư mục con</th>
                    <th>Dự án quản lý</th>
                    <th>Mức quyền</th>
                    <th>Đường dẫn tương đối</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map((r) => (
                    <tr key={r.resource_id}>
                      <td>
                        <div className="resource-name-cell">
                          <Icon name="folder" size={16} />
                          <strong>{r.resource_name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="project-ref">{r.project_name}</span>
                        <span className="code-chip code-chip-sm" style={{ marginLeft: '6px' }}>{r.project_code}</span>
                      </td>
                      <td>
                        <LevelBadge entry={{ level: r.level, levels: [r.level], conflict: false }} />
                      </td>
                      <td>
                        <code className="unc-code">{r.path || 'Thư mục gốc'}</code>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.path && (
                          <button
                            type="button"
                            className={`btn-copy-action ${copiedPath === r.path ? 'copied' : ''}`}
                            onClick={() => copyPath(r.path)}
                            title="Sao chép đường dẫn"
                          >
                            <Icon name={copiedPath === r.path ? 'check' : 'copy'} size={14} />
                            <span>{copiedPath === r.path ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Windows Connection Stepper */}
      <div className="guide-section" id="quick-guide">
        <div className="guide-card">
          <div className="guide-header">
            <div className="guide-icon-box">
              <Icon name="network" size={24} />
            </div>
            <div>
              <div className="guide-badge">HƯỚNG DẪN WINDOWS</div>
              <h3 className="guide-title">Cách kết nối và mở Thư mục mạng trên Windows</h3>
              <p className="guide-desc">Truy cập dữ liệu dự án trên File Server một cách nhanh chóng chỉ với 3 bước đơn giản</p>
            </div>
          </div>

          <div className="stepper-grid">
            <div className="step-box">
              <div className="step-num">1</div>
              <div className="step-content">
                <h4 className="step-title">Sao chép đường dẫn</h4>
                <p className="step-desc">
                  Nhấn nút <span className="highlight-pill">Sao chép</span> ở dự án cần truy cập trong danh sách phía trên.
                </p>
              </div>
            </div>

            <div className="step-box">
              <div className="step-num">2</div>
              <div className="step-content">
                <h4 className="step-title">Mở hộp thoại Run</h4>
                <p className="step-desc">
                  Nhấn tổ hợp phím <kbd className="kbd-key">Win</kbd> + <kbd className="kbd-key">R</kbd> trên bàn phím của bạn.
                </p>
              </div>
            </div>

            <div className="step-box">
              <div className="step-num">3</div>
              <div className="step-content">
                <h4 className="step-title">Dán &amp; Truy cập</h4>
                <p className="step-desc">
                  Dán đường dẫn vừa chép (<kbd className="kbd-key">Ctrl</kbd> + <kbd className="kbd-key">V</kbd>) vào ô và nhấn <kbd className="kbd-key">Enter</kbd>.
                </p>
              </div>
            </div>
          </div>

          {/* Pro Tip Box */}
          <div className="guide-tip-box">
            <div className="tip-header">
              <Icon name="info" size={18} />
              <strong>Mẹo nâng cao: Gắn cố định thành ổ đĩa mạng (Map Network Drive)</strong>
            </div>
            <p className="tip-desc">
              Bạn có thể gán thư mục File Server thành ổ đĩa <code>Z:</code> vĩnh viễn trên máy tính. Mỗi lần khởi động máy tính, ổ đĩa sẽ tự động xuất hiện trong "This PC".
            </p>
            <div className="tip-cmd-wrap">
              <code className="tip-cmd">net use Z: "{filteredProjects[0]?.folder_path || '\\\\fileserver\\DSPC'}" /persistent:yes</code>
              <button
                type="button"
                className={`btn-cmd-copy ${cmdCopied ? 'copied' : ''}`}
                onClick={() => copyNetUseCommand(filteredProjects[0]?.folder_path || '')}
              >
                <Icon name={cmdCopied ? 'check' : 'copy'} size={14} />
                <span>{cmdCopied ? 'Đã sao chép lệnh!' : 'Sao chép lệnh CMD'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
