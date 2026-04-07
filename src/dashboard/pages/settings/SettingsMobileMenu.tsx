/**
 * SettingsMobileMenu — mobile top-level settings category list.
 * Uses SettingsGroup + SettingsRow for consistent glass-card appearance.
 * Tapping a row drills into that section.
 */

import { SettingsGroup } from "./SettingsGroup";
import type { SettingsNavItem } from "./SettingsNav";
import { SettingsRow } from "./SettingsRow";

interface SettingsMobileMenuProps {
	items: SettingsNavItem[];
	onSelect: (id: string) => void;
	appVersion?: string | null;
}

export function SettingsMobileMenu({
	items,
	onSelect,
	appVersion,
}: SettingsMobileMenuProps) {
	return (
		<div className="pb-4">
			{/* Single glass card containing all categories */}
			<SettingsGroup title="Preferences">
				{items.map(({ id, label, description, icon }) => (
					<SettingsRow
						key={id}
						label={label}
						description={description}
						icon={icon}
						onPress={() => onSelect(id)}
						testId={`settings-nav-${id}`}
					/>
				))}
			</SettingsGroup>

			{appVersion && (
				<p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#6B7280]/60 text-center mt-2">
					Agentin v{appVersion}
				</p>
			)}
		</div>
	);
}
