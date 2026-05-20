import React, { useMemo, useState } from "react";
import BrandLogo from "./BrandLogo";
import type { AppSession, ProjectRecord } from "./productTypes";

type ProjectsPageProps = {
  session: AppSession;
  projects: ProjectRecord[];
  onCreateProject: (payload: { name: string; description: string }) => void;
  onUpdateProject: (id: string, payload: { name: string; description: string }) => void;
  onDeleteProject: (id: string) => void;
  onOpenProject: (id: string) => void;
  onLogout: () => void;
  onGoHome: () => void;
};

type EditorPayload = {
  id?: string;
  name: string;
  description: string;
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export default function ProjectsPage({
  session,
  projects,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onOpenProject,
  onLogout,
  onGoHome,
}: ProjectsPageProps) {
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorPayload | null>(null);

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;

    return projects.filter((project) =>
      `${project.name} ${project.description}`.toLowerCase().includes(normalized)
    );
  }, [projects, query]);

  function openCreate() {
    setEditor({ name: "", description: "" });
  }

  function openEdit(project: ProjectRecord) {
    setEditor({
      id: project.id,
      name: project.name,
      description: project.description,
    });
  }

  function submitProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;

    const name = editor.name.trim();
    const description = editor.description.trim();

    if (!name) return;

    if (editor.id) {
      onUpdateProject(editor.id, { name, description });
    } else {
      onCreateProject({ name, description });
    }

    setEditor(null);
  }

  return (
    <div className="projectsShell">
      <header className="projectsTopbar glassMarketingBar">
        <button className="brandResetButton" type="button" onClick={onGoHome}>
          <BrandLogo compact />
        </button>

        <div className="projectsSearch">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects by name or description..."
          />
        </div>

        <div className="projectsUserChip">
          <strong>{session.name}</strong>
          <span>{session.email}</span>
        </div>

        <button className="marketingGhostBtn" type="button" onClick={onLogout}>
          Log out
        </button>
      </header>

      <main className="projectsMain">
        <section className="projectsHero glassShowcase">
          <div>
            <span className="sectionBadge">Workspace</span>
            <h1>Your design projects</h1>
            <p>
              Create, name and manage concepts before launching them into the ORIX editor.
              Every project stores its own canvas locally.
            </p>
          </div>

          <button className="marketingPrimaryBtn large" type="button" onClick={openCreate}>
            + New project
          </button>
        </section>

        <section className="projectsStats">
          <article>
            <strong>{projects.length}</strong>
            <span>Projects</span>
          </article>
          <article>
            <strong>{projects.filter((project) => project.description.trim()).length}</strong>
            <span>With notes</span>
          </article>
          <article>
            <strong>{projects[0] ? formatDate(projects[0].updatedAt) : "—"}</strong>
            <span>Latest update</span>
          </article>
        </section>

        <section className="projectGrid">
          {visibleProjects.map((project) => (
            <article className="projectCard" key={project.id}>
              <div className="projectPreview">
                <div className="projectPreviewGlow" />
                <span />
                <span />
                <span />
              </div>

              <div className="projectCardBody">
                <div className="projectCardHeading">
                  <h2>{project.name}</h2>
                  <button type="button" onClick={() => openEdit(project)}>
                    Edit
                  </button>
                </div>

                <p>{project.description || "No description yet. Add a short project note."}</p>

                <div className="projectMeta">
                  <span>Created {formatDate(project.createdAt)}</span>
                  <span>Updated {formatDate(project.updatedAt)}</span>
                </div>

                <div className="projectActions">
                  <button className="marketingPrimaryBtn" type="button" onClick={() => onOpenProject(project.id)}>
                    Open editor
                  </button>
                  <button
                    className="projectDangerBtn"
                    type="button"
                    onClick={() => onDeleteProject(project.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!visibleProjects.length && (
            <article className="emptyProjectsCard glassSoftPanel">
              <h2>{projects.length ? "Nothing matched your search." : "No projects yet."}</h2>
              <p>
                {projects.length
                  ? "Try another search phrase."
                  : "Create your first project and move straight into the editor."}
              </p>
              {!projects.length && (
                <button className="marketingPrimaryBtn" type="button" onClick={openCreate}>
                  Create first project
                </button>
              )}
            </article>
          )}
        </section>
      </main>

      {editor && (
        <div className="projectDialogBackdrop" role="presentation" onMouseDown={() => setEditor(null)}>
          <section
            className="projectDialog glassAuthCard"
            role="dialog"
            aria-modal="true"
            aria-label={editor.id ? "Edit project" : "Create project"}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2>{editor.id ? "Edit project" : "New project"}</h2>
            <p>Give the project a clear name and a useful note.</p>

            <form onSubmit={submitProject}>
              <label>
                Project name
                <input
                  autoFocus
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                  placeholder="Marketing landing page"
                />
              </label>

              <label>
                Description
                <textarea
                  value={editor.description}
                  onChange={(e) => setEditor((prev) => prev ? { ...prev, description: e.target.value } : prev)}
                  placeholder="What are you building in this project?"
                />
              </label>

              <div className="projectDialogActions">
                <button className="marketingGhostBtn" type="button" onClick={() => setEditor(null)}>
                  Cancel
                </button>
                <button className="marketingPrimaryBtn" type="submit" disabled={!editor.name.trim()}>
                  {editor.id ? "Save changes" : "Create project"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
