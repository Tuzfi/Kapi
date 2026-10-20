/**
 * Kapi Space Search Engine
 * Clean-room reconstruction of Carrier HAP's search architecture:
 * - Carrier.HAP.GUI.Building.ViewModel.LevelEditor.SpacesSearchViewModel
 * - Carrier.HAP.GUI.Building.ViewModel.LevelEditor.ChoiceDrivenSearchSpaceViewModel
 */

export class SpaceSearchEngine {
    constructor() {
        this.searchQuery = "";
        this.includeNotes = false;
        // Tristate: 'All', 'TrueOnly', 'FalseOnly' (mirrors Carrier TristateStatuses)
        this.showMultiLevel = 'All';
        this.showUnmodeled = 'All';
    }

    /**
     * Mirrors Carrier HAP's SpacesSearchViewModel.GetAlphaNumericLowercaseQuery
     * Strips non-alphanumeric characters and converts to lower case for fuzzy matching.
     */
    static getAlphaNumericLowercaseQuery(query) {
        if (!query) return "";
        return query.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    /**
     * Mirrors Carrier HAP's SpacesSearchViewModel.FilterItem
     */
    filterItem(space) {
        // 1. Alphanumeric query test
        const cleanQuery = SpaceSearchEngine.getAlphaNumericLowercaseQuery(this.searchQuery);
        if (cleanQuery.length > 0) {
            const cleanName = SpaceSearchEngine.getAlphaNumericLowercaseQuery(space.name || "");
            const cleanZone = SpaceSearchEngine.getAlphaNumericLowercaseQuery(space.zone || "");
            let matches = cleanName.includes(cleanQuery) || cleanZone.includes(cleanQuery);

            if (!matches && this.includeNotes && space.notes) {
                const cleanNotes = SpaceSearchEngine.getAlphaNumericLowercaseQuery(space.notes);
                matches = cleanNotes.includes(cleanQuery);
            }

            if (!matches) {
                return false;
            }
        }

        // 2. Multi-level status test
        if (this.showMultiLevel === 'TrueOnly' && !space.isMultiLevel) return false;
        if (this.showMultiLevel === 'FalseOnly' && space.isMultiLevel) return false;

        // 3. Unmodeled status test
        if (this.showUnmodeled === 'TrueOnly' && !space.isUnmodeled) return false;
        if (this.showUnmodeled === 'FalseOnly' && space.isUnmodeled) return false;

        return true;
    }

    /**
     * Filter array of spaces and returns results with count summary
     */
    filterSpaces(spaces) {
        const filtered = spaces.filter(space => this.filterItem(space));
        const countString = `${filtered.length} of ${spaces.length} spaces displayed`;
        return {
            items: filtered,
            totalCount: spaces.length,
            matchCount: filtered.length,
            countString: countString
        };
    }
}
