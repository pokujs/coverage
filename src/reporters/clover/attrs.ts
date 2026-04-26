/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Metric } from '../../@types/text.js';
import type { XmlAttrs } from '../../@types/xml.js';
import { metrics } from '../shared/metrics.js';

export const baseMetrics = (
  lines: Metric,
  branches: Metric,
  functions: Metric
): XmlAttrs => ({
  statements: metrics.total(lines),
  coveredstatements: metrics.covered(lines),
  conditionals: metrics.total(branches),
  coveredconditionals: metrics.covered(branches),
  methods: metrics.total(functions),
  coveredmethods: metrics.covered(functions),
});

export const rootMetrics = (
  lines: Metric,
  branches: Metric,
  functions: Metric,
  packages: number,
  files: number
): XmlAttrs => {
  const linesTotal = metrics.total(lines);
  const elements =
    linesTotal + metrics.total(branches) + metrics.total(functions);
  const coveredElements =
    metrics.covered(lines) +
    metrics.covered(branches) +
    metrics.covered(functions);
  return {
    ...baseMetrics(lines, branches, functions),
    elements,
    coveredelements: coveredElements,
    complexity: 0,
    loc: linesTotal,
    ncloc: linesTotal,
    packages,
    files,
    classes: files,
  };
};
