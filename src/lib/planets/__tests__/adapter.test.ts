import { describe, it, expect } from 'bun:test';
import { buildPlanetsGraph } from '../adapter';
import type { MapDocument as ApiMapDocument, OracleProject } from '../../../api/oracle';

const NOW = Date.parse('2026-04-19T00:00:00Z');

function proj(p: string, docs: number): OracleProject {
  return { project: p, docs, types: 2, last_indexed: 0 };
}

function apiDoc(id: string, project: string, concepts: string[]): ApiMapDocument {
  return {
    id,
    type: 'principle',
    source_file: `${project}/${id}.md`,
    concepts,
    project,
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random() * 2 - 1,
    created_at: '2026-04-15T00:00:00Z',
  };
}

describe('buildPlanetsGraph', () => {
  it('returns empty graph for no input', () => {
    const g = buildPlanetsGraph([], [], undefined, NOW);
    expect(g.documents.length).toBe(0);
    expect(g.clusters.length).toBe(0);
    expect(g.nebulae.length).toBe(0);
  });

  it('maps API docs → KM documents', () => {
    const projects = [proj('repo/a', 2)];
    const docs = [
      apiDoc('d1', 'repo/a', ['x', 'y']),
      apiDoc('d2', 'repo/a', ['y', 'z']),
    ];
    const g = buildPlanetsGraph(docs, projects, undefined, NOW);
    expect(g.documents.length).toBe(2);
    const d1 = g.documents.find((d) => d.id === 'd1')!;
    expect(d1.sourceFile).toBe('repo/a/d1.md');
    expect(d1.clusterId).toBe('repo/a');
    expect(d1.createdAt).toBe(Date.parse('2026-04-15T00:00:00Z'));
    expect(d1.parentId).toBeNull();
    expect(d1.moonCount).toBe(0);
    expect(d1.contentLength).toBeGreaterThan(0);
  });

  it('groups docs into one cluster per project', () => {
    const projects = [proj('repo/a', 1), proj('repo/b', 1)];
    const docs = [apiDoc('d1', 'repo/a', []), apiDoc('d2', 'repo/b', [])];
    const g = buildPlanetsGraph(docs, projects, undefined, NOW);
    expect(g.clusters.length).toBe(2);
    const labels = g.clusters.map((c) => c.label).sort();
    expect(labels).toEqual(['a', 'b']);
  });

  it('emits nebulae for projects that share ≥3 concepts', () => {
    const projects = [proj('repo/a', 1), proj('repo/b', 1)];
    const shared = ['p', 'q', 'r'];
    const docs = [
      apiDoc('d1', 'repo/a', shared),
      apiDoc('d2', 'repo/b', shared),
    ];
    const g = buildPlanetsGraph(docs, projects, undefined, NOW);
    expect(g.nebulae.length).toBe(1);
    expect(new Set([g.nebulae[0].clusterA, g.nebulae[0].clusterB])).toEqual(
      new Set(['repo/a', 'repo/b']),
    );
  });

  it('puts orphan docs (project=null) in the Unsorted cluster', () => {
    const docs: ApiMapDocument[] = [
      { ...apiDoc('d1', 'anywhere', ['x']), project: null },
    ];
    const g = buildPlanetsGraph(docs, [], undefined, NOW);
    expect(g.clusters.length).toBe(1);
    expect(g.clusters[0].label).toBe('Unsorted');
    expect(g.documents[0].clusterId).toBe('__unknown__');
  });

  it('snapshot structure: small 3-project / 6-doc fixture', () => {
    const projects = [proj('repo/a', 2), proj('repo/b', 2), proj('repo/c', 2)];
    const docs = [
      apiDoc('a1', 'repo/a', ['ml', 'ai']),
      apiDoc('a2', 'repo/a', ['ml', 'nlp']),
      apiDoc('b1', 'repo/b', ['ml', 'ai', 'nlp']),
      apiDoc('b2', 'repo/b', ['ml']),
      apiDoc('c1', 'repo/c', ['biology']),
      apiDoc('c2', 'repo/c', ['chemistry']),
    ];
    const g = buildPlanetsGraph(docs, projects, undefined, NOW);
    expect(g.documents.length).toBe(6);
    expect(g.clusters.length).toBe(3);
    for (const d of g.documents) {
      expect(Number.isFinite(d.orbitRadius)).toBe(true);
      expect(Number.isFinite(d.orbitSpeed)).toBe(true);
    }
  });
});
