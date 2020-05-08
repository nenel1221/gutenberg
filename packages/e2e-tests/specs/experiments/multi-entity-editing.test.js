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
	await page.keyboard.type( textToAdd );
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
			`//label[@class="components-checkbox-control__label"]//strong[contains(text(),"${ name }")]`
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

		await visitSiteEditor();
		await createTemplate( templateName );
		await createTemplatePart( templatePartName );
		await editTemplatePart( 'Default template part test text.' );
		await saveAllEntities();
	} );

	afterAll( async () => {
		await disableExperimentalFeatures( requiredExperiments );
	} );

	describe( 'Multi-entity edit', () => {
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

		it.skip( 'should only dirty the child when editing the child', () => {} );

		it.skip( 'should only dirty the grandchild when editing the grandchild', () => {} );
	} );

	describe.skip( 'Switching to another entity', () => {
		it( 'should not delete nested entity blocks when zooming in', () => {} );
		it( 'should not delete nested entity blocks when displaying the preview', () => {} );
		it( 'should not delete nested entity blocks when switching back to the top-level entity', () => {} );
		it( 'should not dirty any entities', () => {} );
		it( 'should not dirty any entities after switching back', () => {} );
		it( 'should not dirty any entities when displaying the preview', () => {} );
	} );

	describe.skip( 'Multi-entity undo', () => {
		describe( 'Undoing a change to a parent entity', () => {
			it( 'should only undo the parent entity', async () => {} );
			it( 'should not delete other entities from the editor', () => {} );
		} );

		describe( 'Undoing a change to a child entity', () => {
			it( 'should only undo the parent entity', () => {} );
			it( 'should not delete a child entity', () => {} );
		} );

		describe( 'Undoing changes with multi-nested child entities', () => {
			it( 'should only undo itself without affecting parents', () => {} );
		} );
	} );
} );
