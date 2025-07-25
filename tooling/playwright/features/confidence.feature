Feature: As a visitor I want to visit the website in order to see what the business offers

  @timeout:5000
  Scenario: Visit the Domain
    Given I have an open browser
    When I navigate to "https://www.onibi.co.uk/"
    Then I see "It's Always DNS" in the title
    And I have no problems navigating the site
