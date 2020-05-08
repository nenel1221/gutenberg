/**
 * External dependencies
 */
import { kebabCase } from 'lodash';

/**
 * WordPress dependencies
 */
import { insertBlock, visitAdminPage } from '@wordpress/e2e-test-utils';
import { addQueryArgs } from '@wordpress/url';

/**
 * Internal dependencies
 */
import {
	enableExperimentalFeatures,
	disableExperimentalFeatures,
} from '../../experimental-features';
import { trashExistingPosts } from '../../config/setup-test-framework';

const visitSiteEditor = async () => {
	const query = addQueryArgs( '', {
		page: 'gutenberg-edit-site',
	} ).slice( 1 );
	await visitAdminPage( 'admin.php', query );
	// Waits for the template part to load...
	await page.waitForSelector(
		'.wp-block[data-type="core/template-part"] .block-editor-inner-blocks'
	);
};

const createTemplate = async ( templateName = 'test-template' ) => {
	// Open the dropdown menu.
	const templateDropdown =
		'button.components-dropdown-menu__toggle[aria-label="Switch Template"]';
	await page.click( templateDropdown );
	await page.waitForSelector( '.edit-site-template-switcher__popover' );

	// Click the "new template" button.
	const [ createNewTemplateButton ] = await page.$x(
		'//div[contains(@class, "edit-site-template-switcher__popover")]//button[contains(., "New")]'
	);
	await createNewTemplateButton.click();
	await page.waitForSelector( '.components-modal__frame' );

	// Create a new template with the given name.
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Tab' );
	await page.keyboard.type( templateName );
	const [ addTemplateButton ] = await page.$x(
		'//div[contains(@class, "components-modal__frame")]//button[contains(., "Add")]'
	);
	await addTemplateButton.click();

	// Wait for the site editor to load the new template.
	await page.waitForXPath(
		`//button[contains(@class, "components-dropdown-menu__toggle")][contains(text(), "${ kebabCase(
			templateName
		) }")]`,
		{ timeout: 3000 }
	);
};

const createTemplatePart = async (
	templatePartName = 'test-template-part',
	themeName = 'test-theme'
) => {
	// Create new template part.
	await insertBlock( 'Template Part' );
	await page.keyboard.type( templatePartName );
	await page.keyboard.press( 'Tab' );
	await page.keyboard.type( themeName );
	await page.keyboard.press( 'Tab' );
	await page.keyboard.press( 'Enter' );
	await page.waitForSelector(
		'div[data-type="core/template-part"] .block-editor-inner-blocks'
	);
};

const editTemplatePart = async ( textToAdd ) => {
	await page.click( 'div[data-type="core/template-part"]' );
	for ( const text of textToAdd ) {
		await page.keyboard.type( text );
		await page.keyboard.press( 'Enter' );
	}
};

const saveAllEntities = async () => {
	if ( await openEntitySavePanel() ) {
		await page.click( 'button.editor-entities-saved-states__save-button' );
	}
};

const openEntitySavePanel = async () => {
	// Open the entity save panel if it is not already open.
	try {
		await page.waitForSelector( '.entities-saved-states__panel', {
			timeout: 100,
		} );
	} catch {
		try {
			await page.click(
				'.edit-site-save-button__button[aria-disabled=false]',
				{ timeout: 100 }
			);
		} catch {
			return false; // Not dirty because the button is disabled.
		}
		await page.waitForSelector( '.entities-saved-states__panel' );
	}
	// If we made it this far, the panel is opened.
	return true;
};

const isEntityDirty = async ( name ) => {
	const isOpen = await openEntitySavePanel();
	if ( ! isOpen ) {
		return false;
	}
	try {
		await page.waitForXPath(
			`//label[@class="components-checkbox-control__label"]//strong[contains(text(),"${ name }")]`,
			{ timeout: 500 }
		);
		return true;
	} catch {}
	return false;
};

describe( 'Multi-entity editor states', () => {
	// Setup & Teardown.
	const requiredExperiments = [
		'#gutenberg-full-site-editing',
		'#gutenberg-full-site-editing-demo',
	];
	const templatePartName = 'Test Template Part Name Edit';
	const templateName = 'Test Template Name Edit';

	beforeAll( async () => {
		await enableExperimentalFeatures( requiredExperiments );
		await trashExistingPosts( 'wp_template' );
		await trashExistingPosts( 'wp_template_part' );
	} );

	afterAll( async () => {
		await disableExperimentalFeatures( requiredExperiments );
	} );

	it( 'should not display any dirty entities when loading the site editor', async () => {
		await visitSiteEditor();
		expect( await openEntitySavePanel() ).toBe( true );

		await saveAllEntities();
		await visitSiteEditor();

		// Unable to open the save panel implies that no entities are dirty.
		expect( await openEntitySavePanel() ).toBe( false );
	} );

	describe( 'Multi-entity edit', () => {
		beforeAll( async () => {
			await visitSiteEditor();
			await createTemplate( templateName );
			await createTemplatePart( templatePartName );
			await editTemplatePart( [
				'Default template part test text.',
				'Second paragraph test.',
			] );
			await saveAllEntities();
			// TODO: Add back console mocks when
			// https://github.com/WordPress/gutenberg/issues/17355 is fixed.
			/* eslint-disable no-console */
			console.warn.mockReset();
			console.error.mockReset();
			console.info.mockReset();
			/* eslint-enable no-console */
		} );

		afterEach( async () => {
			await saveAllEntities();
			// TODO: Add back console mocks when
			// https://github.com/WordPress/gutenberg/issues/17355 is fixed.
			/* eslint-disable no-console */
			console.warn.mockReset();
			console.error.mockReset();
			console.info.mockReset();
			/* eslint-enable no-console */
		} );

		it( 'should only dirty the parent entity when editing the parent', async () => {
			await page.click( '.block-editor-button-block-appender' );
			await page.waitForSelector( '.block-editor-inserter__menu' );
			await page.click( 'button.editor-block-list-item-paragraph' );

			// Add changes to the main parent entity.
			await page.keyboard.type( 'Test.' );

			const isParentEntityDirty = await isEntityDirty( templateName );
			const isChildEntityDirty = await isEntityDirty( templatePartName );

			expect( isParentEntityDirty ).toBe( true );
			expect( isChildEntityDirty ).toBe( false );
		} );

		it( 'should only dirty the child when editing the child', async () => {
			await page.click(
				'.wp-block[data-type="core/template-part"] .wp-block[data-type="core/paragraph"]'
			);
			await page.keyboard.type( 'Some more test words!' );

			const isParentEntityDirty = await isEntityDirty( templateName );
			const isChildEntityDirty = await isEntityDirty( templatePartName );

			expect( isParentEntityDirty ).toBe( false );
			expect( isChildEntityDirty ).toBe( true );
		} );
	} );
} );
