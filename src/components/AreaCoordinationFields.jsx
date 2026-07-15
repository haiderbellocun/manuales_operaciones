import { SelectField } from '../components';
import { areaRequiresCoordination, coordinationsForArea } from '../utils/areas';

export function AreaCoordinationFields({
  areas = [],
  coordinations = [],
  areaValue = '',
  coordinationValue = '',
  onAreaChange,
  onCoordinationChange,
  areaLabel = 'Área responsable *',
  coordinationLabel = 'Coordinación *',
  areaDisabled = false,
  coordinationDisabled = false,
  areaPlaceholder = 'Seleccionar...',
  coordinationPlaceholder = 'Seleccionar coordinación...',
  allowEmptyArea = false,
  allowEmptyCoordination = false,
  emptyCoordinationLabel = 'Todas las coordinaciones',
}) {
  const selectedArea = areas.find(a => String(a.id) === String(areaValue));
  const needsCoordination = areaRequiresCoordination(selectedArea);
  const coordinationOptions = coordinationsForArea(coordinations, areaValue);

  return (
    <>
      <div className="form-row">
        <label>{areaLabel}</label>
        <SelectField
          value={areaValue}
          disabled={areaDisabled || areas.length === 0}
          onChange={onAreaChange}
          placeholder={areaPlaceholder}
          options={[
            ...(allowEmptyArea ? [{ value: '', label: 'Sin área' }] : []),
            ...areas.map(a => ({ value: a.id, label: a.name })),
          ]}
        />
      </div>
      {needsCoordination && (
        <div className="form-row">
          <label>{coordinationLabel}</label>
          <SelectField
            value={coordinationValue}
            disabled={coordinationDisabled || coordinationOptions.length === 0}
            onChange={onCoordinationChange}
            placeholder={coordinationPlaceholder}
            options={[
              ...(allowEmptyCoordination ? [{ value: '', label: emptyCoordinationLabel }] : []),
              ...coordinationOptions.map(c => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      )}
    </>
  );
}
