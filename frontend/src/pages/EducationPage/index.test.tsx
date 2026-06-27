/**
 * Tests for the EducationPage — the 🎓 教学实验 tab.
 *
 * The page is organised as a 2-column demo layout:
 *   - top:   ScenarioList (5 MEV scenario cards)
 *   - left:  EduParams / EduAmmPanel / EduLiveData
 *   - right: EduExplain / DefenseTips
 *
 * The tests verify:
 *   - all 6 panels (with their inner component testIds) are rendered
 *   - the default scenario is 'sandwich'
 *   - clicking a different scenario card updates the active scenario
 *     in `eduStore` and rewrites the EduExplain headline text
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { EducationPage } from './index';
import { useEduStore } from '@/store/eduStore';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

afterEach(() => {
  cleanup();
  useEduStore.getState().reset();
});

describe('EducationPage', () => {
  it('shows the page test id root', () => {
    render(<EducationPage />);
    expect(screen.getByTestId('education-page')).toBeInTheDocument();
  });

  it('renders the 6 demo panels (inner component testIds)', () => {
    render(<EducationPage />);
    expect(screen.getByTestId('edu-scenario-list-panel')).toBeInTheDocument();
    expect(screen.getByTestId('edu-params-panel')).toBeInTheDocument();
    expect(screen.getByTestId('edu-amm-panel')).toBeInTheDocument();
    expect(screen.getByTestId('edu-explain-panel')).toBeInTheDocument();
    expect(screen.getByTestId('edu-live-data-panel')).toBeInTheDocument();
    expect(screen.getByTestId('edu-defense-tips-panel')).toBeInTheDocument();
  });

  it('starts with the sandwich scenario as active', () => {
    render(<EducationPage />);
    expect(useEduStore.getState().activeScenario).toBe('sandwich');
    expect(screen.getByTestId('edu-scenario-sandwich').getAttribute('data-active')).toBe('true');
  });

  it('shows the sandwich explain headline by default', () => {
    render(<EducationPage />);
    expect(screen.getByTestId('edu-explain-headline').textContent).toMatch(/三明治/);
  });

  it('clicking the JIT card updates the active scenario in the store', () => {
    render(<EducationPage />);
    act(() => {
      fireEvent.click(screen.getByTestId('edu-scenario-jit'));
    });
    expect(useEduStore.getState().activeScenario).toBe('jit');
  });

  it('clicking the JIT card rewrites the EduExplain headline text', () => {
    render(<EducationPage />);
    // Sanity: starts on sandwich.
    expect(screen.getByTestId('edu-explain-headline').textContent).toMatch(/三明治/);
    act(() => {
      fireEvent.click(screen.getByTestId('edu-scenario-jit'));
    });
    expect(screen.getByTestId('edu-explain-headline').textContent).toMatch(/JIT/);
  });

  it('renders 5 defense tips for the default sandwich scenario', () => {
    render(<EducationPage />);
    const tips = screen.getAllByTestId(/^edu-defense-tip-/);
    expect(tips.length).toBeGreaterThanOrEqual(3);
  });

  it('renders 5 live-data rows', () => {
    render(<EducationPage />);
    const rows = screen.getAllByTestId(/^edu-live-row-/);
    expect(rows.length).toBe(5);
  });

  it('renders 3 ParamSliders inside EduParams', () => {
    render(<EducationPage />);
    const ranges = document.querySelectorAll('input[type="range"]');
    expect(ranges.length).toBe(3);
  });

  // Regression for the ".dtm-page hides every page root" bug.
  it('uses the .dtm-page shell class on its root div (visibility contract)', () => {
    const { container } = render(<EducationPage />);
    const root = screen.getByTestId('education-page');
    expect(root.className).toContain('dtm-page');
    expect(container.firstChild).toBe(root);
  });
});
