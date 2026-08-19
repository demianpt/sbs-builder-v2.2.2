<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once $root . '/wordpress-plugin/sbs-website-importer/includes/class-sbs-importer-package.php';
require_once $root . '/wordpress-plugin/sbs-website-importer/includes/class-sbs-importer-block-converter.php';
require_once $root . '/wordpress-plugin/sbs-website-importer/includes/class-sbs-importer-theme.php';

$fixture = static function ( string $name ) use ( $root ): array {
	return json_decode( file_get_contents( $root . '/tests/fixtures/wordpress/' . $name ), true, 512, JSON_THROW_ON_ERROR );
};
$assertions = array();
$check = static function ( bool $condition, string $label ) use ( &$assertions ): void {
	$assertions[] = array( 'label' => $label, 'passed' => $condition );
	if ( ! $condition ) fwrite( STDERR, "FAIL: {$label}\n" );
};

$page = $fixture( 'page.json' );
$navigation = $fixture( 'navigation.json' );
$footer = $fixture( 'footer.json' );
$complete = $fixture( 'complete-project.json' );

$converter = new SBS_Importer_Block_Converter();
$page_result = $converter->page_to_content( $page );
$check( ! is_wp_error( $page_result ), 'page conversion succeeds' );
$page_content = is_wp_error( $page_result ) ? '' : $page_result['content'];
$check( str_contains( $page_content, '<!-- wp:ds-blocks/dst-banner' ), 'page contains native DST banner block comments' );
$check( str_contains( $page_content, 'bannerHeight' ), 'camelCase registered attributes are preserved' );
$check( ! str_contains( $page_content, '<!-- wp:core/' ), 'core block comments use canonical WordPress names' );
$check( ! str_contains( $page_content, 'sbs-figma-snapshot-image' ), 'page contains no screenshot module markup' );
$check( ( $page_result['blocks'] ?? 0 ) > 30, 'page conversion includes a complete nested block tree' );

$nav_result = $converter->navigation_to_content( $navigation, 123 );
$check( ! is_wp_error( $nav_result ), 'navigation conversion succeeds' );
$nav_content = is_wp_error( $nav_result ) ? '' : $nav_result['content'];
$check( str_contains( $nav_content, '<!-- wp:ds-blocks/dst-navigation' ), 'navigation becomes editable DST navigation blocks' );
$check( str_contains( $nav_content, '"menuValue":"123"' ), 'WordPress menu ID is injected into navigation block' );
$check( ( $nav_result['blocks'] ?? 0 ) < ( $page_result['blocks'] ?? PHP_INT_MAX ), 'converter counters reset between artifacts' );

$footer_result = $converter->footer_to_content( $footer );
$check( ! is_wp_error( $footer_result ), 'footer conversion succeeds' );
$footer_content = is_wp_error( $footer_result ) ? '' : $footer_result['content'];
$check( str_contains( $footer_content, '<!-- wp:ds-blocks/dst-wrapper' ), 'footer becomes an editable DST wrapper' );
$check( str_contains( $footer_content, '<!-- wp:ds-blocks/c-heading' ), 'footer menu headings are real heading blocks' );
$check( str_contains( $footer_content, '<!-- wp:ds-blocks/c-list' ), 'footer links are editable list blocks' );

$warnings = array();
$split = SBS_Importer_Package::split_artifacts( $complete, $warnings );
$check( ! is_wp_error( $split ), 'complete-project JSON is accepted' );
$check( is_array( $split ) && array_keys( $split ) === array( 'page', 'navigation', 'footer' ), 'complete-project JSON splits into page, navigation, and footer' );

$css = SBS_Importer_Theme::build_css( (array) ( $page['concept']['theme'] ?? array() ) );
$check( str_contains( $css, '--dst--primary-color1:' ), 'theme CSS includes semantic DST colors' );
$check( str_contains( $css, '.editor-styles-wrapper' ), 'theme CSS is available in Gutenberg editor canvas' );
$check( ! preg_match( '/url\s*\(/i', $css ), 'theme CSS contains no external URL values' );
$check( str_contains( $css, '--sbs-grid-gap:' ) || empty( $page['concept']['theme']['designDialTokens'] ), 'resolved design-dial tokens are preserved when exported' );
$dial_css = SBS_Importer_Theme::build_css( array( 'designDialTokens' => array( 'gridGap' => '2.75rem', 'measure' => '68ch', 'motionDuration' => '0.42s', 'mediaSaturate' => '1.1' ) ) );
$check( str_contains( $dial_css, '--sbs-grid-gap:2.75rem;' ), 'WordPress consumes the exact exported grid-gap dial token' );
$check( str_contains( $dial_css, '--sbs-measure:68ch;' ), 'WordPress consumes the exact exported reading-measure dial token' );
$check( str_contains( $dial_css, '--sbs-motion-duration:0.42s;' ), 'WordPress consumes the exact exported motion dial token' );

$passed = count( array_filter( $assertions, static fn( array $a ): bool => $a['passed'] ) );
$report = array(
	'passed' => $passed === count( $assertions ),
	'assertionsPassed' => $passed,
	'assertionsTotal' => count( $assertions ),
	'pageBlocks' => is_wp_error( $page_result ) ? 0 : $page_result['blocks'],
	'navigationBlocks' => is_wp_error( $nav_result ) ? 0 : $nav_result['blocks'],
	'footerBlocks' => is_wp_error( $footer_result ) ? 0 : $footer_result['blocks'],
	'pageBytes' => strlen( $page_content ),
	'navigationBytes' => strlen( $nav_content ),
	'footerBytes' => strlen( $footer_content ),
	'themeCssBytes' => strlen( $css ),
	'assertions' => $assertions,
);
@mkdir( $root . '/test-results', 0777, true );
file_put_contents( $root . '/test-results/wordpress-importer-unit.json', json_encode( $report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );
echo json_encode( $report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n";
exit( $report['passed'] ? 0 : 1 );
