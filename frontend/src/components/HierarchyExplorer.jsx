import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { percent } from "../utils/formatters";
import ReportValue from "./ReportValue";
import { getEventMetricFields, visibleSectors } from "../utils/snapshot";
import { SectorIcon, StatusBadge } from "./dashboard/DashboardPrimitives";

function valueFor(item, field) {
  const value = item?.[field];
  return value === null || value === undefined ? 0 : value;
}

function variationClass(value) {
  if (Number(value) > 0) return "positive-text";
  if (Number(value) < 0) return "negative-text";
  return "";
}

function RowValues({ item, fields, metric, unit }) {
  const difference = valueFor(item, fields.difference);
  const variation = valueFor(item, fields.variation);
  return (
    <div className="hierarchy-values">
      <strong>
        <ReportValue
          value={valueFor(item, fields.current)}
          metric={metric}
          unit={unit}
        />
      </strong>
      <span>
        <ReportValue
          value={valueFor(item, fields.previous)}
          metric={metric}
          unit={unit}
        />
      </span>
      <span className={`hierarchy-difference ${variationClass(difference)}`}>
        <ReportValue value={difference} metric={metric} unit={unit} />
      </span>
      <em className={variationClass(variation)}>
        <StatusBadge value={variation} />
      </em>
    </div>
  );
}

function SummaryValues({ scope, fields, metric, unit }) {
  const difference = valueFor(scope, fields.difference);
  const variation = valueFor(scope, fields.variation);

  return (
    <div className="hierarchy-summary-values">
      <div>
        <small>Atual</small>
        <strong>
          <ReportValue
            value={valueFor(scope, fields.current)}
            metric={metric}
            unit={unit}
          />
        </strong>
      </div>
      <div>
        <small>Anterior</small>
        <strong>
          <ReportValue
            value={valueFor(scope, fields.previous)}
            metric={metric}
            unit={unit}
          />
        </strong>
      </div>
      <div>
        <small>Diferença</small>
        <strong className={variationClass(difference)}>
          <ReportValue value={difference} metric={metric} unit={unit} />
        </strong>
      </div>
      <div>
        <small>Variação</small>
        <strong className={variationClass(variation)}>
          {percent(variation)}
        </strong>
      </div>
    </div>
  );
}

export default function HierarchyExplorer({
  snapshot,
  scope,
  carouselMode = false,
}) {
  const [openSector, setOpenSector] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const metric =
    snapshot?.snapshot_type === "EVENT" ? snapshot.metric : "monetary";
  const unit = snapshot?.unit;
  const eventFields = getEventMetricFields(snapshot);
  const fields =
    snapshot?.snapshot_type === "EVENT"
      ? eventFields
      : {
          current: "current_value",
          previous: "previous_value",
          difference: "difference_value",
          variation: "variation_percent",
        };

  const sectors = useMemo(
    () => visibleSectors(snapshot, scope),
    [snapshot, scope],
  );

  const toggleSector = (key) => {
    setOpenSector((current) => (current === key ? null : key));
    setOpenGroup(null);
  };

  return (
    <section
      className={`hierarchy-panel hierarchy-panel-compact ${carouselMode ? "hierarchy-panel-carousel" : ""}`}
    >
      <div className="section-heading section-heading-compact">
        <div>
          <h2>Setores</h2>
        </div>
        <div className="table-legend">
          <span>Atual</span>
          <span>
            <span className="report-full-label">Anterior</span>
            <span className="report-short-label">Ant.</span>
          </span>
          <span className="legend-difference">
            <span className="report-full-label">Diferença</span>
            <span className="report-short-label">Dif.</span>
          </span>
          <span>
            <span className="report-full-label">Variação</span>
            <span className="report-short-label">%</span>
          </span>
        </div>
      </div>

      <div className="hierarchy-list">
        {sectors.map((sector) => {
          const sectorKey = sector.key || sector.name;
          const sectorOpen = openSector === sectorKey;
          return (
            <article
              className={`hierarchy-sector ${sectorOpen ? "open" : ""}`}
              key={sectorKey}
            >
              <button
                type="button"
                className="hierarchy-row sector-row"
                aria-expanded={sectorOpen}
                onClick={() => toggleSector(sectorKey)}
              >
                <div className="hierarchy-name">
                  {sectorOpen ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                  <SectorIcon name={sector.name} />
                  <div>
                    <strong>{sector.name}</strong>
                  </div>
                </div>
                <RowValues
                  item={sector}
                  fields={fields}
                  metric={metric}
                  unit={unit}
                />
              </button>

              {sectorOpen && (
                <div className="group-list">
                  {(sector.groups || []).map((group) => {
                    const groupKey = `${sectorKey}:${group.key || group.name}`;
                    const groupOpen = openGroup === groupKey;
                    return (
                      <div className="group-block" key={groupKey}>
                        <button
                          type="button"
                          className="hierarchy-row group-row"
                          aria-expanded={groupOpen}
                          onClick={() =>
                            setOpenGroup((current) =>
                              current === groupKey ? null : groupKey,
                            )
                          }
                        >
                          <div className="hierarchy-name">
                            {groupOpen ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            <div>
                              <strong>{group.name}</strong>
                            </div>
                          </div>
                          <RowValues
                            item={group}
                            fields={fields}
                            metric={metric}
                            unit={unit}
                          />
                        </button>

                        {groupOpen && (
                          <div className="subgroup-list">
                            {(group.subgroups || []).map((subgroup) => (
                              <div
                                className="hierarchy-row subgroup-row"
                                key={`${groupKey}:${subgroup.code || subgroup.key}`}
                              >
                                <div className="hierarchy-name">
                                  <span className="subgroup-dot" />
                                  <div>
                                    <strong>{subgroup.name}</strong>
                                  </div>
                                </div>
                                <RowValues
                                  item={subgroup}
                                  fields={fields}
                                  metric={metric}
                                  unit={unit}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {scope ? (
        <footer className="hierarchy-summary-footer">
          <div className="hierarchy-summary-label">
            <strong>Resultado</strong>
            <span>Resumo final da loja selecionada</span>
          </div>
          <SummaryValues
            scope={scope}
            fields={fields}
            metric={metric}
            unit={unit}
          />
        </footer>
      ) : null}
    </section>
  );
}
