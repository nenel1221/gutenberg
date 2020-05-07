/**
 * External dependencies
 */
import { kebabCase } from 'lodash';

/**
 * Internal dependencies
 */
import { searchForBlock } from './search-for-block';

/**
 * Opens the inserter, searches for the given term, then selects the first
 * result that appears.
 *
 * @param {string} searchTerm  The text to search the inserter for.
 */
export async function insertBlock( searchTerm ) {
	await searchForBlock( searchTerm );
	const insertButton = (
		await page.$x( `//button//span[contains(text(), '${ searchTerm }')]` )
	 )[ 0 ];
	await insertButton.click();

	// Wait for the block to show up for 500ms, but do not fail the test if it
	// doesn't exist. To find the block, we match elements with a data-type whose
	// value ends with the search term in kebab case. For example, if "Container
	// without paragraph" was passed as the search term, it matches a block with
	// `data-type="test/container-without-paragraph"`.
	try {
		await page.waitForSelector(
			`.wp-block[data-type$="${ kebabCase( searchTerm ) }"]`,
			{ timeout: 500 }
		);
	} catch {}
}
