import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import SettingsModal from './SettingsModal';

const defaultProfile = {
  home: { lat: 48.2082, lng: 16.3738, address: "Stephansplatz, 1010 Wien" },
  germanLevel: "none",
  roleLevel: "mid-senior",
  salaryFloor: 55,
  salaryTarget: 70,
  salaryStretch: 85,
  yearsExperience: 5,
};

const renderSettings = (overrides = {}) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <SettingsModal
      open={true}
      onClose={onClose}
      profile={defaultProfile}
      defaultProfile={defaultProfile}
      onSave={onSave}
      {...overrides}
    />
  );
  return { onSave, onClose, ...result };
};

describe("SettingsModal", () => {
  it("form reflects profile on open", () => {
    renderSettings();
    expect(screen.getByDisplayValue("55")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stephansplatz, 1010 Wien")).toBeInTheDocument();
  });

  it("Save calls onSave with form data and onClose", async () => {
    const { onSave, onClose } = renderSettings();
    await userEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ salaryFloor: 55 }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel calls onClose without onSave", async () => {
    const { onSave, onClose } = renderSettings();
    await userEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Load sample replaces form with defaultProfile", async () => {
    const customProfile = { ...defaultProfile, salaryFloor: 99 };
    renderSettings({ profile: customProfile });
    expect(screen.getByDisplayValue("99")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Load sample profile"));
    expect(screen.getByDisplayValue("55")).toBeInTheDocument();
  });

  it("field edit updates local state only (not onSave)", async () => {
    const { onSave } = renderSettings();
    const salaryInput = screen.getByDisplayValue("55");
    await userEvent.clear(salaryInput);
    await userEvent.type(salaryInput, "60");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("discards an unsaved draft when reopened", async () => {
    const props = {
      onClose: vi.fn(),
      onSave: vi.fn(),
      profile: defaultProfile,
      defaultProfile,
    };
    const view = render(<SettingsModal {...props} open={true} />);
    const salaryInput = screen.getByDisplayValue("55");
    await userEvent.clear(salaryInput);
    await userEvent.type(salaryInput, "99");
    view.rerender(<SettingsModal {...props} open={false} />);
    view.rerender(<SettingsModal {...props} open={true} />);
    expect(screen.getByDisplayValue("55")).toBeInTheDocument();
  });

  // Nominatim lookup tests
  it("successful lookup updates lat/lng and shows 'Coordinates updated'", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        return HttpResponse.json([{ lat: "48.1234", lon: "16.5678" }]);
      })
    );
    renderSettings();
    await userEvent.click(screen.getByText("Lookup"));
    await waitFor(() => expect(screen.getByText("Coordinates updated")).toBeInTheDocument());
  });

  it("empty result shows 'Address not found'", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        return HttpResponse.json([]);
      })
    );
    renderSettings();
    await userEvent.click(screen.getByText("Lookup"));
    await waitFor(() => expect(screen.getByText(/Address not found/)).toBeInTheDocument());
  });

  it("HTTP error shows 'Address not found'", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    renderSettings();
    await userEvent.click(screen.getByText("Lookup"));
    await waitFor(() => expect(screen.getByText(/Address not found/)).toBeInTheDocument());
  });

  it("network error shows 'Address not found'", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        return HttpResponse.error();
      })
    );
    renderSettings();
    await userEvent.click(screen.getByText("Lookup"));
    await waitFor(() => expect(screen.getByText(/Address not found/)).toBeInTheDocument());
  });

  it("lookup button is disabled while loading", async () => {
    let resolve;
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        return new Promise(r => { resolve = r; });
      })
    );
    renderSettings();
    await userEvent.click(screen.getByText("Lookup"));
    expect(screen.getByText("...")).toBeDisabled();
    resolve(HttpResponse.json([]));
    await waitFor(() => expect(screen.getByText("Lookup")).toBeEnabled());
  });

  it("Enter in address field triggers lookup", async () => {
    server.use(
      http.get("https://nominatim.openstreetmap.org/search", () => {
        return HttpResponse.json([{ lat: "48.0", lon: "16.0" }]);
      })
    );
    renderSettings();
    const addrInput = screen.getByDisplayValue("Stephansplatz, 1010 Wien");
    await userEvent.type(addrInput, "{Enter}");
    await waitFor(() => expect(screen.getByText("Coordinates updated")).toBeInTheDocument());
  });
});
